import { Module } from "@nestjs/common";
import { AppModule } from "./app.module.js";
import { SeedModule } from "./modules/seed/seed.module.js";

@Module({
  imports: [AppModule, SeedModule],
})
export class RuntimeModule {}
