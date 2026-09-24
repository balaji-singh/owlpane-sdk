from owlpane import emit_test_span, shutdown, start

fn = start()
if fn is None:
    raise SystemExit("owlpane did not start — check examples/.env")
emit_test_span("hello-owlpane")
shutdown()
print("span emitted (check Owlpane console)")
