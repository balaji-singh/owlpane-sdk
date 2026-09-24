package main

import (
	"context"
	"fmt"
	"log"

	"github.com/balaji-singh/owlpane-sdk/packages/go/owlpane"
)

func main() {
	ctx := context.Background()
	shutdown, err := owlpane.Start(ctx, nil)
	if err != nil {
		log.Fatal(err)
	}
	if shutdown == nil {
		log.Fatal("owlpane did not start — check examples/.env")
	}
	if err := owlpane.EmitTestSpan(ctx, "hello-owlpane"); err != nil {
		log.Fatal(err)
	}
	if err := shutdown(ctx); err != nil {
		log.Fatal(err)
	}
	fmt.Println("span emitted (check Owlpane console)")
}
