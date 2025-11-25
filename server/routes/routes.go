package routes

import (
	"fmt"
	"net/http"

	"content-hub/server/config"
	"content-hub/server/frontend"
	"content-hub/server/handlers"
	"content-hub/server/middleware"
	"content-hub/server/models"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
	"gorm.io/gorm"
)

// SetupRouter wires API routes and the embedded frontend bundle so the built
// binary can serve both surfaces without extra assets.
func SetupRouter(db *gorm.DB, cfg *config.Config) (*gin.Engine, error) {
	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{cfg.AllowOrigin, "http://localhost:5173"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Authorization", "Content-Type", "X-API-Key"},
		AllowCredentials: true,
	}))

	api := r.Group("/api")
	{
		api.POST("/login", handlers.Login(db, cfg))
		api.POST("/apikeys/verify", handlers.VerifyAPIKey(db))
		// 分享预览接口：根据分享策略可选登录
		api.GET("/shares/:token", handlers.GetShareMeta(db, cfg))
		api.GET("/shares/:token/stream", handlers.StreamShare(db, cfg))
		api.GET("/shares/:token/download", handlers.DownloadShare(db, cfg))

		// 文件上传支持 JWT 或 API Key 两种鉴权方式，便于未来按 scope 扩展到更多接口
		api.POST("/files", middleware.APIKeyOrAuth(db, cfg, models.ScopeFilesUpload), handlers.UploadFile(db, cfg))

		authorized := api.Group("")
		authorized.Use(middleware.AuthRequired(cfg))

		// file operations
		authorized.GET("/files", handlers.ListFiles(db))
		authorized.GET("/files/:id", handlers.GetFileInfo(db))
		authorized.GET("/files/:id/download", handlers.DownloadFile(db))
		authorized.GET("/files/:id/stream", handlers.StreamFile(db))
		authorized.DELETE("/files/:id", handlers.DeleteFile(db))
		authorized.POST("/files/:id/share", handlers.CreateShare(db, cfg))

		// admin
		admin := authorized.Group("/admin")
		admin.Use(middleware.RequireAdmin())
		admin.POST("/users", handlers.CreateUser(db))
		admin.GET("/users", handlers.ListUsers(db))
		admin.DELETE("/users/:id", handlers.DeleteUser(db))
		admin.PATCH("/users/:id/role", handlers.UpdateUserRole(db))
		admin.POST("/users/:id/reset-password", handlers.ResetPassword(db))
		admin.GET("/apikeys", handlers.ListAPIKeys(db))
		admin.POST("/apikeys", handlers.CreateAPIKey(db))
		admin.DELETE("/apikeys/:id", handlers.RevokeAPIKey(db))
		admin.GET("/shares", handlers.ListShares(db))
		admin.POST("/shares/cleanup", handlers.CleanShares(db))
		admin.DELETE("/shares/:token", handlers.RevokeShare(db))
	}

	// Swagger UI：单一路由，兼容 /swagger 与 /swagger/ 入口
	swaggerHandler := ginSwagger.WrapHandler(swaggerFiles.Handler)
	r.GET("/swagger/*any", func(c *gin.Context) {
		p := c.Param("any")
		if p == "" || p == "/" {
			c.Redirect(http.StatusFound, "/swagger/index.html")
			return
		}
		swaggerHandler(c)
	})

	// legacy download 地址不再使用，返回提示，避免暴露真实下载入口
	r.GET("/share/:token", handlers.LegacyShareRedirect())

	r.GET("/health", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "ok"}) })

	assets, err := frontend.Assets()
	if err != nil {
		return nil, fmt.Errorf("load embedded frontend: %w", err)
	}
	frontend.Register(r, assets)

	return r, nil
}
