// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

export interface UserViewForBitmap {
  readonly id: string;
}

export abstract class UserQueryPort {
  abstract findById(userId: string): Promise<UserViewForBitmap | null>;
}
