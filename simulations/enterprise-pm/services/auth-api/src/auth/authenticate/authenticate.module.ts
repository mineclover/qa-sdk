// @def.boundary sim-auth-api
// @def.doc authorization-ontology-bitmap-pipeline

import { type DynamicModule, Module } from "@nestjs/common";
import { AuthenticateController } from "./authenticate.controller.js";
import { UserModule } from "../user/user.module.js";
import {
  CREDENTIAL_STORE,
  type CredentialStore,
  NoopCredentialStore,
} from "./credential-store.js";

export interface AuthenticateModuleOptions {
  /** 기본은 NoopCredentialStore. test-bootstrap에서 TestCredentialStore 주입. */
  credentialStore?: CredentialStore;
}

@Module({})
export class AuthenticateModule {
  static forRoot(opts: AuthenticateModuleOptions = {}): DynamicModule {
    const store = opts.credentialStore ?? new NoopCredentialStore();
    return {
      module: AuthenticateModule,
      imports: [UserModule],
      controllers: [AuthenticateController],
      providers: [
        {
          provide: CREDENTIAL_STORE,
          useValue: store,
        },
      ],
      exports: [CREDENTIAL_STORE],
    };
  }
}
