import { Inject, Injectable, Optional } from "@nestjs/common";
import type { DevDkgProvider } from "../../lib/dev-dkg-provider.js";
import { DEV_DKG_PROVIDER } from "../catalog/catalog.change-notifier.js";
import type { AxisChangeHandler } from "./axis.service.js";

@Injectable()
export class AxisChangeNotifier implements AxisChangeHandler {
  constructor(
    @Optional() @Inject(DEV_DKG_PROVIDER) private readonly devDashboardProvider?: DevDkgProvider,
  ) {}

  axisChanged(_catalogId: string, _axisId: string) {
    this.devDashboardProvider?.refresh();
  }
}
