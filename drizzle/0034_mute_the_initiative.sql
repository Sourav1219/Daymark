CREATE TABLE "profile_photos" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"image_base64" text NOT NULL,
	"content_type" varchar(32) DEFAULT 'image/webp' NOT NULL,
	"byte_size" integer NOT NULL,
	"width" integer DEFAULT 512 NOT NULL,
	"height" integer DEFAULT 512 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_photos_type_check" CHECK ("profile_photos"."content_type" = 'image/webp'),
	CONSTRAINT "profile_photos_size_check" CHECK ("profile_photos"."byte_size" between 1 and 409600),
	CONSTRAINT "profile_photos_dimensions_check" CHECK ("profile_photos"."width" = 512 and "profile_photos"."height" = 512),
	CONSTRAINT "profile_photos_version_check" CHECK ("profile_photos"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "profile_photos" ADD CONSTRAINT "profile_photos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;