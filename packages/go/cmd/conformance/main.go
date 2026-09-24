package main

import (
	"context"
	"log"
	"os"

	"github.com/balaji-singh/owlpane-sdk/packages/go/owlpane"
)

func main() {
	ctx := context.Background()
	shutdown, err := owlpane.Start(ctx, nil)
	if err != nil {
		log.Fatal(err)
	}
	if shutdown == nil {
		log.Fatal("expected owlpane to start")
	}
	if err := owlpane.EmitTestSpan(ctx, "hello-owlpane"); err != nil {
		log.Fatal(err)
	}
	if err := shutdown(ctx); err != nil {
		log.Fatal(err)
	}
	os.Exit(0)
}
