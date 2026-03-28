import { Inject, Injectable, Optional } from "@nestjs/common";
import type { DevDkgProvider } from "../../lib/dev-dkg-provider.js";
import type { CatalogChangeHandler } from "./catalog.service.js";

export const DEV_DKG_PROVIDER = "DEV_DKG_PROVIDER";

@Injectable()
export class CatalogChangeNotifier implements CatalogChangeHandler {
  constructor(
    @Optional() @Inject(DEV_DKG_PROVIDER) private readonly devDashboardProvider?: DevDkgProvider,
  ) {}

  catalogChanged(_catalogId: string) {
    this.devDashboardProvider?.refresh();
  }
}
