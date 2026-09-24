"""One-shot conformance: emit hello-owlpane span via owlpane.start()."""
from owlpane import emit_test_span, shutdown, start


def main() -> None:
    fn = start()
    if fn is None:
        raise SystemExit("owlpane did not start")
    emit_test_span("hello-owlpane")
    shutdown()


if __name__ == "__main__":
    main()
