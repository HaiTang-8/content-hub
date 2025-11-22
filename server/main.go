package main

// Content Hub Swagger 元信息，用于 swaggo 生成 OpenAPI 文档。
//
// @title Content Hub API
// @version 1.0
// @description 文件与分享服务的后端接口，支持 JWT 与 API Key 双鉴权。
// @host localhost:8080
// @BasePath /api
// @schemes http
// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description 以 Bearer Token 传递的 JWT，例如：Bearer <token>
// @securityDefinitions.apikey ApiKeyAuth
// @in header
// @name X-API-Key
// @description 管理端生成的 API Key，当前支持 files:upload 权限

import (
	"log"

	"content-hub/server/config"
	"content-hub/server/database"
	docs "content-hub/server/docs"
	"content-hub/server/routes"
)

func main() {
	cfg := config.Load()

	// 运行时更新 swagger 基础配置，避免打包后 host/BasePath 不一致。
	docs.SwaggerInfo.Host = "localhost:" + cfg.Port
	docs.SwaggerInfo.BasePath = "/api"
	docs.SwaggerInfo.Schemes = []string{"http"}

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
