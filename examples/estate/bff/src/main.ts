// The SDK starts before anything else is imported so every library is instrumented.
import "reflect-metadata";
import { owlpane } from "@owlpane/node";
owlpane.start({ service: "demo-bff", ingestKey: process.env.OWLPANE_INGEST_KEY, endpoint: process.env.OWLPANE_ENDPOINT, environment: "production", release: "3.1.0" });

import { Body, Controller, Get, HttpException, Injectable, Module, Param, Post, Req, UseInterceptors } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { Cron, CronExpression, ScheduleModule } from "@nestjs/schedule";
import { installNestJobTracing, OwlpaneUserInterceptor } from "@owlpane/node/nest";
import { Pool } from "pg";

installNestJobTracing(); // traces @Cron jobs automatically

const SCORES = process.env.SCORES_URL!, STATS = process.env.STATS_URL!, PAYMENTS = process.env.PAYMENTS_URL!;
const pool = new Pool({ connectionString: process.env.ESTATE_DB, max: 4 });

@Injectable()
class Fixtures {
  // A background job. Every fifth run fails, so the Jobs page has a failure with a trace.
  private runs = 0;
  @Cron(CronExpression.EVERY_10_SECONDS, { name: "sync-fixtures" })
  async sync() {
    this.runs++;
    await pool.query("SELECT count(*) FROM matches");
    if (this.runs % 5 === 0) throw new Error("fixtures provider returned 429");
  }
}

@Controller("api")
@UseInterceptors(OwlpaneUserInterceptor)
class Api {
  @Get("matches")
  async matches() {
    const { rows } = await pool.query("SELECT id, league, home, away FROM matches ORDER BY id LIMIT 20");
    return rows;
  }

  @Get("matches/:id")
  async match(@Param("id") id: string) {
    const [score, stats] = await Promise.all([fetch(`${SCORES}/scores/${id}`), fetch(`${STATS}/stats/${id}`)]);
    if (!score.ok) throw new HttpException("score unavailable", 502);
    return { score: await score.json(), stats: stats.ok ? await stats.json() : null };
  }

  @Post("checkout")
  async checkout(@Body() _body: unknown, @Req() _req: unknown) {
    const r = await fetch(`${PAYMENTS}/charge`, { method: "POST" });
    if (!r.ok) throw new HttpException("payment failed", 502);
    return r.json();
  }
}

@Module({ imports: [ScheduleModule.forRoot()], controllers: [Api], providers: [Fixtures] })
class AppModule {}

async function main() {
  const app = await NestFactory.create(AppModule, { logger: ["error", "warn"] });
  // Stands in for real authentication: the caller's id arrives in a header and becomes req.user, which the SDK tags on the trace.
  app.use((req: any, _res: unknown, next: () => void) => {
    const id = req.headers["x-user-id"];
    if (typeof id === "string") req.user = { id };
    next();
  });
  app.enableCors({ origin: true, allowedHeaders: ["content-type", "traceparent", "x-user-id"] });
  await app.listen(5100);
  console.log("demo-bff on :5100");
}
main();
