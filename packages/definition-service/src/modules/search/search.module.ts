import { Global, Module } from "@nestjs/common";
import { SearchService } from "./search.service.js";

@Global()
@Module({
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
