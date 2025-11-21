package main

import (
	"log"

	"content-hub/server/config"
	"content-hub/server/database"
	"content-hub/server/routes"
)

func main() {
	cfg := config.Load()

	db, err := database.Connect(cfg)
	if err != nil {
		log.Fatalf("failed to connect database: %v", err)
	}

	router, err := routes.SetupRouter(db, cfg)
	if err != nil {
		log.Fatalf("failed to init router: %v", err)
	}

	if err := router.Run(cfg.Addr()); err != nil {
		log.Fatalf("server exited: %v", err)
	}
}
