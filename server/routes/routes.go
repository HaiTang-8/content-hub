package routes

import (
	"net/http"

	"content-hub/server/config"
	"content-hub/server/handlers"
	"content-hub/server/middleware"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupRouter(db *gorm.DB, cfg *config.Config) *gin.Engine {
	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{cfg.AllowOrigin, "http://localhost:5173"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Authorization", "Content-Type"},
		AllowCredentials: true,
	}))

	api := r.Group("/api")
	{
		api.POST("/login", handlers.Login(db, cfg))

		authorized := api.Group("")
		authorized.Use(middleware.AuthRequired(cfg))

		// file operations
		authorized.GET("/files", handlers.ListFiles(db))
		authorized.POST("/files", handlers.UploadFile(db, cfg))
		authorized.GET("/files/:id", handlers.GetFileInfo(db))
		authorized.GET("/files/:id/download", handlers.DownloadFile(db))
		authorized.GET("/files/:id/stream", handlers.StreamFile(db))
		authorized.DELETE("/files/:id", handlers.DeleteFile(db))
		authorized.POST("/files/:id/share", handlers.ShareFile(db))

		// admin
		admin := authorized.Group("/admin")
		admin.Use(middleware.RequireAdmin())
		admin.POST("/users", handlers.CreateUser(db))
	}

	// public share endpoint
	r.GET("/share/:token", handlers.DownloadByToken(db))

	r.GET("/health", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "ok"}) })

	return r
}
