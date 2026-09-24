/**
 * @owlpane/node/nest — optional NestJS helpers, kept out of the main entry point so a plain Node
 * or Express service pulls in no NestJS code.
 *
 * import { installNestJobTracing, OwlpaneUserInterceptor } from "@owlpane/node/nest";
 * installNestJobTracing();   // after owlpane.start(), before app.listen()
 */
import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from "@nestjs/common";
import { Injectable, Logger, Module } from "@nestjs/common";
import type { Observable } from "rxjs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import "reflect-metadata";
import { job, setUser, traceUserProfileEnabled, type JobKind } from "./index";

const logger = new Logger("OwlpaneNest");

/** Registers Nest job tracing. Call `owlpane.start()` before the application module is created. */
@Module({})
export class OwlpaneModule {
  constructor() {
    installNestJobTracing();
  }
}

/** Load a peer from the host app (BFF), not from @owlpane/node's copy — otherwise monkey-patches miss. */
function requireFromHost<T = unknown>(specifier: string): T {
  const roots = new Set<string>();
  const entry = process.argv[1];
  if (entry) roots.add(join(dirname(entry), ".."));
  roots.add(process.cwd());
  for (const root of roots) {
    try {
      return createRequire(join(root, "package.json"))(specifier) as T;
    } catch {
      // try next root
    }
  }
  return require(specifier) as T;
}

const SCHEDULER_KIND: Record<number, JobKind> = {
  1: "cron",
  2: "timeout",
  3: "interval",
};

let installed = false;

/**
 * Traces every `@Cron`/`@Interval`/`@Timeout` handler (`@nestjs/schedule`) and every BullMQ
 * processor (`@nestjs/bullmq`) as its own root span, named after the class and method or the
 * queue and job name. Each run also feeds the `job.duration` histogram.
 *
 * Works by patching two library extension points instead of touching job code, so a version bump
 * that renames either seam only disables tracing for that one (logged), never breaks the app.
 */
export function installNestJobTracing(): void {
  if (installed) return;
  installed = true;
  installScheduleTracing();
  installBullmqTracing();
}

function installScheduleTracing(): void {
  try {
    /* eslint-disable @typescript-eslint/no-require-imports -- optional peer dep, loaded lazily */
    const { ScheduleExplorer } = requireFromHost<{ ScheduleExplorer: { prototype: { wrapFunctionInTryCatchBlocks: unknown } } }>(
      "@nestjs/schedule/dist/schedule.explorer",
    );
    const { SCHEDULER_TYPE } = requireFromHost<Record<string, unknown>>(
      "@nestjs/schedule/dist/schedule.constants",
    );
    /* eslint-enable @typescript-eslint/no-require-imports */
    const original = ScheduleExplorer?.prototype?.wrapFunctionInTryCatchBlocks;
    if (typeof original !== "function")
      throw new Error("wrapFunctionInTryCatchBlocks not found");

    ScheduleExplorer.prototype.wrapFunctionInTryCatchBlocks = function (
      methodRef: (...args: unknown[]) => unknown,
      instance: object,
    ) {
      const className = (instance as { constructor: { name: string } })?.constructor?.name ?? "Job";
      const method = methodRef?.name || "run";
      const kind: JobKind =
        SCHEDULER_KIND[
          Reflect.getMetadata(SCHEDULER_TYPE, methodRef) as number
        ] ?? "cron";
      const name = `${className}.${method}`;
      const traced = function (this: unknown, ...args: unknown[]) {
        return job(
          name,
          kind,
          { "code.namespace": className, "code.function": method },
          async () => methodRef.apply(this, args),
        );
      };
      return original.call(this, traced, instance);
    };
  } catch (err) {
    logger.warn(`Scheduled jobs will not be traced: ${String(err)}`);
  }
}

function installBullmqTracing(): void {
  try {
    /* eslint-disable @typescript-eslint/no-require-imports -- optional peer dep, loaded lazily */
    const { ProcessorDecoratorService } = requireFromHost<{
      ProcessorDecoratorService: { prototype: { decorate: unknown } };
    }>("@nestjs/bullmq/dist/instrument/processor-decorator.service");
    /* eslint-enable @typescript-eslint/no-require-imports */
    const original = ProcessorDecoratorService?.prototype?.decorate;
    if (typeof original !== "function")
      throw new Error("ProcessorDecoratorService.decorate not found");

    ProcessorDecoratorService.prototype.decorate = function (
      processor: (...args: unknown[]) => unknown,
    ) {
      const decorated = original.call(this, processor) as (
        ...args: unknown[]
      ) => Promise<unknown>;
      return (
        bullJob: {
          queueName?: string;
          name?: string;
          id?: string | number;
          attemptsMade?: number;
        },
        ...rest: unknown[]
      ) => {
        const queue = bullJob?.queueName ?? "queue";
        const name = `${queue}.${bullJob?.name ?? "job"}`;
        return job(
          name,
          "queue",
          {
            "messaging.system": "bullmq",
            "messaging.destination.name": queue,
            "messaging.message.id": String(bullJob?.id ?? ""),
            "job.attempt": (bullJob?.attemptsMade ?? 0) + 1,
          },
          () => decorated(bullJob, ...rest),
        );
      };
    };
  } catch (err) {
    logger.warn(`Queue jobs will not be traced: ${String(err)}`);
  }
}

/**
 * Register globally (`APP_INTERCEPTOR`) to tag each request's trace with the signed-in user
 * (`req.user.id`) once auth guards have run, for per-user activity and error views in the console.
 */
@Injectable()
export class OwlpaneUserInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() === "http") {
      const req = context.switchToHttp().getRequest<{
        user?: { id?: unknown; email?: unknown; name?: unknown };
      }>();
      if (typeof req.user?.id === "string") {
        setUser(
          req.user.id,
          traceUserProfileEnabled()
            ? {
                email: typeof req.user.email === "string" ? req.user.email : undefined,
                name: typeof req.user.name === "string" ? req.user.name : undefined,
              }
            : undefined,
        );
      }
    }
    return next.handle();
  }
}
