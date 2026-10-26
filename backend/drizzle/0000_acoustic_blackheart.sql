CREATE TABLE "connector_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"connector_version" text NOT NULL,
	"sim_name" text NOT NULL,
	"sim_version_major" integer NOT NULL,
	"sim_version_minor" integer NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"connector_session_id" text NOT NULL,
	"seq" integer NOT NULL,
	"ts" timestamp with time zone NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"altitude_ft" double precision NOT NULL,
	"altitude_agl_ft" double precision NOT NULL,
	"heading_true_deg" double precision NOT NULL,
	"ground_speed_kts" double precision NOT NULL,
	"indicated_airspeed_kts" double precision NOT NULL,
	"vertical_speed_fpm" double precision NOT NULL,
	"on_ground" boolean NOT NULL,
	"fuel_weight_lbs" double precision NOT NULL,
	CONSTRAINT "positions_connector_session_id_seq_pk" PRIMARY KEY("connector_session_id","seq")
);
--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_connector_session_id_connector_sessions_id_fk" FOREIGN KEY ("connector_session_id") REFERENCES "public"."connector_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "positions_session_ts_idx" ON "positions" USING btree ("connector_session_id","ts");