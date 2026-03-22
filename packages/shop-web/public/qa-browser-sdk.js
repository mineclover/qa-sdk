var Ue = Object.defineProperty;
var We = (n, e, t) => e in n ? Ue(n, e, { enumerable: !0, configurable: !0, writable: !0, value: t }) : n[e] = t;
var k = (n, e, t) => We(n, typeof e != "symbol" ? e + "" : e, t);
function kn(n) {
  return {
    env: n.env,
    region: n.region,
    svc_name: n.name,
    namespace: n.namespace
  };
}
function He(n, e, t) {
  return {
    service_name: `${n.namespace}/${n.name}`,
    sdk_name: e,
    sdk_version: t
  };
}
function Je(n) {
  return {
    env: Ge(n.env),
    ...n.build != null ? { build_ref: n.build } : {},
    ...n.releaseVersion != null ? { release_version: n.releaseVersion } : {}
  };
}
const Ke = {
  prod: "production",
  stage: "staging"
}, Qe = {
  production: "prod",
  staging: "stage"
};
function Ge(n) {
  return Ke[n] ?? n;
}
function xn(n) {
  return Qe[n] ?? n;
}
var b;
(function(n) {
  n.assertEqual = (a) => {
  };
  function e(a) {
  }
  n.assertIs = e;
  function t(a) {
    throw new Error();
  }
  n.assertNever = t, n.arrayToEnum = (a) => {
    const s = {};
    for (const i of a)
      s[i] = i;
    return s;
  }, n.getValidEnumValues = (a) => {
    const s = n.objectKeys(a).filter((o) => typeof a[a[o]] != "number"), i = {};
    for (const o of s)
      i[o] = a[o];
    return n.objectValues(i);
  }, n.objectValues = (a) => n.objectKeys(a).map(function(s) {
    return a[s];
  }), n.objectKeys = typeof Object.keys == "function" ? (a) => Object.keys(a) : (a) => {
    const s = [];
    for (const i in a)
      Object.prototype.hasOwnProperty.call(a, i) && s.push(i);
    return s;
  }, n.find = (a, s) => {
    for (const i of a)
      if (s(i))
        return i;
  }, n.isInteger = typeof Number.isInteger == "function" ? (a) => Number.isInteger(a) : (a) => typeof a == "number" && Number.isFinite(a) && Math.floor(a) === a;
  function r(a, s = " | ") {
    return a.map((i) => typeof i == "string" ? `'${i}'` : i).join(s);
  }
  n.joinValues = r, n.jsonStringifyReplacer = (a, s) => typeof s == "bigint" ? s.toString() : s;
})(b || (b = {}));
var ve;
(function(n) {
  n.mergeShapes = (e, t) => ({
    ...e,
    ...t
    // second overwrites first
  });
})(ve || (ve = {}));
const d = b.arrayToEnum([
  "string",
  "nan",
  "number",
  "integer",
  "float",
  "boolean",
  "date",
  "bigint",
  "symbol",
  "function",
  "undefined",
  "null",
  "array",
  "object",
  "unknown",
  "promise",
  "void",
  "never",
  "map",
  "set"
]), R = (n) => {
  switch (typeof n) {
    case "undefined":
      return d.undefined;
    case "string":
      return d.string;
    case "number":
      return Number.isNaN(n) ? d.nan : d.number;
    case "boolean":
      return d.boolean;
    case "function":
      return d.function;
    case "bigint":
      return d.bigint;
    case "symbol":
      return d.symbol;
    case "object":
      return Array.isArray(n) ? d.array : n === null ? d.null : n.then && typeof n.then == "function" && n.catch && typeof n.catch == "function" ? d.promise : typeof Map < "u" && n instanceof Map ? d.map : typeof Set < "u" && n instanceof Set ? d.set : typeof Date < "u" && n instanceof Date ? d.date : d.object;
    default:
      return d.unknown;
  }
}, l = b.arrayToEnum([
  "invalid_type",
  "invalid_literal",
  "custom",
  "invalid_union",
  "invalid_union_discriminator",
  "invalid_enum_value",
  "unrecognized_keys",
  "invalid_arguments",
  "invalid_return_type",
  "invalid_date",
  "invalid_string",
  "too_small",
  "too_big",
  "invalid_intersection_types",
  "not_multiple_of",
  "not_finite"
]);
class O extends Error {
  get errors() {
    return this.issues;
  }
  constructor(e) {
    super(), this.issues = [], this.addIssue = (r) => {
      this.issues = [...this.issues, r];
    }, this.addIssues = (r = []) => {
      this.issues = [...this.issues, ...r];
    };
    const t = new.target.prototype;
    Object.setPrototypeOf ? Object.setPrototypeOf(this, t) : this.__proto__ = t, this.name = "ZodError", this.issues = e;
  }
  format(e) {
    const t = e || function(s) {
      return s.message;
    }, r = { _errors: [] }, a = (s) => {
      for (const i of s.issues)
        if (i.code === "invalid_union")
          i.unionErrors.map(a);
        else if (i.code === "invalid_return_type")
          a(i.returnTypeError);
        else if (i.code === "invalid_arguments")
          a(i.argumentsError);
        else if (i.path.length === 0)
          r._errors.push(t(i));
        else {
          let o = r, u = 0;
          for (; u < i.path.length; ) {
            const h = i.path[u];
            u === i.path.length - 1 ? (o[h] = o[h] || { _errors: [] }, o[h]._errors.push(t(i))) : o[h] = o[h] || { _errors: [] }, o = o[h], u++;
          }
        }
    };
    return a(this), r;
  }
  static assert(e) {
    if (!(e instanceof O))
      throw new Error(`Not a ZodError: ${e}`);
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, b.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(e = (t) => t.message) {
    const t = {}, r = [];
    for (const a of this.issues)
      if (a.path.length > 0) {
        const s = a.path[0];
        t[s] = t[s] || [], t[s].push(e(a));
      } else
        r.push(e(a));
    return { formErrors: r, fieldErrors: t };
  }
  get formErrors() {
    return this.flatten();
  }
}
O.create = (n) => new O(n);
const le = (n, e) => {
  let t;
  switch (n.code) {
    case l.invalid_type:
      n.received === d.undefined ? t = "Required" : t = `Expected ${n.expected}, received ${n.received}`;
      break;
    case l.invalid_literal:
      t = `Invalid literal value, expected ${JSON.stringify(n.expected, b.jsonStringifyReplacer)}`;
      break;
    case l.unrecognized_keys:
      t = `Unrecognized key(s) in object: ${b.joinValues(n.keys, ", ")}`;
      break;
    case l.invalid_union:
      t = "Invalid input";
      break;
    case l.invalid_union_discriminator:
      t = `Invalid discriminator value. Expected ${b.joinValues(n.options)}`;
      break;
    case l.invalid_enum_value:
      t = `Invalid enum value. Expected ${b.joinValues(n.options)}, received '${n.received}'`;
      break;
    case l.invalid_arguments:
      t = "Invalid function arguments";
      break;
    case l.invalid_return_type:
      t = "Invalid function return type";
      break;
    case l.invalid_date:
      t = "Invalid date";
      break;
    case l.invalid_string:
      typeof n.validation == "object" ? "includes" in n.validation ? (t = `Invalid input: must include "${n.validation.includes}"`, typeof n.validation.position == "number" && (t = `${t} at one or more positions greater than or equal to ${n.validation.position}`)) : "startsWith" in n.validation ? t = `Invalid input: must start with "${n.validation.startsWith}"` : "endsWith" in n.validation ? t = `Invalid input: must end with "${n.validation.endsWith}"` : b.assertNever(n.validation) : n.validation !== "regex" ? t = `Invalid ${n.validation}` : t = "Invalid";
      break;
    case l.too_small:
      n.type === "array" ? t = `Array must contain ${n.exact ? "exactly" : n.inclusive ? "at least" : "more than"} ${n.minimum} element(s)` : n.type === "string" ? t = `String must contain ${n.exact ? "exactly" : n.inclusive ? "at least" : "over"} ${n.minimum} character(s)` : n.type === "number" ? t = `Number must be ${n.exact ? "exactly equal to " : n.inclusive ? "greater than or equal to " : "greater than "}${n.minimum}` : n.type === "bigint" ? t = `Number must be ${n.exact ? "exactly equal to " : n.inclusive ? "greater than or equal to " : "greater than "}${n.minimum}` : n.type === "date" ? t = `Date must be ${n.exact ? "exactly equal to " : n.inclusive ? "greater than or equal to " : "greater than "}${new Date(Number(n.minimum))}` : t = "Invalid input";
      break;
    case l.too_big:
      n.type === "array" ? t = `Array must contain ${n.exact ? "exactly" : n.inclusive ? "at most" : "less than"} ${n.maximum} element(s)` : n.type === "string" ? t = `String must contain ${n.exact ? "exactly" : n.inclusive ? "at most" : "under"} ${n.maximum} character(s)` : n.type === "number" ? t = `Number must be ${n.exact ? "exactly" : n.inclusive ? "less than or equal to" : "less than"} ${n.maximum}` : n.type === "bigint" ? t = `BigInt must be ${n.exact ? "exactly" : n.inclusive ? "less than or equal to" : "less than"} ${n.maximum}` : n.type === "date" ? t = `Date must be ${n.exact ? "exactly" : n.inclusive ? "smaller than or equal to" : "smaller than"} ${new Date(Number(n.maximum))}` : t = "Invalid input";
      break;
    case l.custom:
      t = "Invalid input";
      break;
    case l.invalid_intersection_types:
      t = "Intersection results could not be merged";
      break;
    case l.not_multiple_of:
      t = `Number must be a multiple of ${n.multipleOf}`;
      break;
    case l.not_finite:
      t = "Number must be finite";
      break;
    default:
      t = e.defaultError, b.assertNever(n);
  }
  return { message: t };
};
let Ye = le;
function Xe() {
  return Ye;
}
const et = (n) => {
  const { data: e, path: t, errorMaps: r, issueData: a } = n, s = [...t, ...a.path || []], i = {
    ...a,
    path: s
  };
  if (a.message !== void 0)
    return {
      ...a,
      path: s,
      message: a.message
    };
  let o = "";
  const u = r.filter((h) => !!h).slice().reverse();
  for (const h of u)
    o = h(i, { data: e, defaultError: o }).message;
  return {
    ...a,
    path: s,
    message: o
  };
};
function c(n, e) {
  const t = Xe(), r = et({
    issueData: e,
    data: n.data,
    path: n.path,
    errorMaps: [
      n.common.contextualErrorMap,
      // contextual error map is first priority
      n.schemaErrorMap,
      // then schema-bound map if available
      t,
      // then global override map
      t === le ? void 0 : le
      // then global default map
    ].filter((a) => !!a)
  });
  n.common.issues.push(r);
}
class w {
  constructor() {
    this.value = "valid";
  }
  dirty() {
    this.value === "valid" && (this.value = "dirty");
  }
  abort() {
    this.value !== "aborted" && (this.value = "aborted");
  }
  static mergeArray(e, t) {
    const r = [];
    for (const a of t) {
      if (a.status === "aborted")
        return _;
      a.status === "dirty" && e.dirty(), r.push(a.value);
    }
    return { status: e.value, value: r };
  }
  static async mergeObjectAsync(e, t) {
    const r = [];
    for (const a of t) {
      const s = await a.key, i = await a.value;
      r.push({
        key: s,
        value: i
      });
    }
    return w.mergeObjectSync(e, r);
  }
  static mergeObjectSync(e, t) {
    const r = {};
    for (const a of t) {
      const { key: s, value: i } = a;
      if (s.status === "aborted" || i.status === "aborted")
        return _;
      s.status === "dirty" && e.dirty(), i.status === "dirty" && e.dirty(), s.value !== "__proto__" && (typeof i.value < "u" || a.alwaysSet) && (r[s.value] = i.value);
    }
    return { status: e.value, value: r };
  }
}
const _ = Object.freeze({
  status: "aborted"
}), U = (n) => ({ status: "dirty", value: n }), S = (n) => ({ status: "valid", value: n }), be = (n) => n.status === "aborted", ke = (n) => n.status === "dirty", z = (n) => n.status === "valid", X = (n) => typeof Promise < "u" && n instanceof Promise;
var f;
(function(n) {
  n.errToObj = (e) => typeof e == "string" ? { message: e } : e || {}, n.toString = (e) => typeof e == "string" ? e : e == null ? void 0 : e.message;
})(f || (f = {}));
class I {
  constructor(e, t, r, a) {
    this._cachedPath = [], this.parent = e, this.data = t, this._path = r, this._key = a;
  }
  get path() {
    return this._cachedPath.length || (Array.isArray(this._key) ? this._cachedPath.push(...this._path, ...this._key) : this._cachedPath.push(...this._path, this._key)), this._cachedPath;
  }
}
const xe = (n, e) => {
  if (z(e))
    return { success: !0, data: e.value };
  if (!n.common.issues.length)
    throw new Error("Validation failed but no issues detected.");
  return {
    success: !1,
    get error() {
      if (this._error)
        return this._error;
      const t = new O(n.common.issues);
      return this._error = t, this._error;
    }
  };
};
function g(n) {
  if (!n)
    return {};
  const { errorMap: e, invalid_type_error: t, required_error: r, description: a } = n;
  if (e && (t || r))
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  return e ? { errorMap: e, description: a } : { errorMap: (i, o) => {
    const { message: u } = n;
    return i.code === "invalid_enum_value" ? { message: u ?? o.defaultError } : typeof o.data > "u" ? { message: u ?? r ?? o.defaultError } : i.code !== "invalid_type" ? { message: o.defaultError } : { message: u ?? t ?? o.defaultError };
  }, description: a };
}
class v {
  get description() {
    return this._def.description;
  }
  _getType(e) {
    return R(e.data);
  }
  _getOrReturnCtx(e, t) {
    return t || {
      common: e.parent.common,
      data: e.data,
      parsedType: R(e.data),
      schemaErrorMap: this._def.errorMap,
      path: e.path,
      parent: e.parent
    };
  }
  _processInputParams(e) {
    return {
      status: new w(),
      ctx: {
        common: e.parent.common,
        data: e.data,
        parsedType: R(e.data),
        schemaErrorMap: this._def.errorMap,
        path: e.path,
        parent: e.parent
      }
    };
  }
  _parseSync(e) {
    const t = this._parse(e);
    if (X(t))
      throw new Error("Synchronous parse encountered promise.");
    return t;
  }
  _parseAsync(e) {
    const t = this._parse(e);
    return Promise.resolve(t);
  }
  parse(e, t) {
    const r = this.safeParse(e, t);
    if (r.success)
      return r.data;
    throw r.error;
  }
  safeParse(e, t) {
    const r = {
      common: {
        issues: [],
        async: (t == null ? void 0 : t.async) ?? !1,
        contextualErrorMap: t == null ? void 0 : t.errorMap
      },
      path: (t == null ? void 0 : t.path) || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data: e,
      parsedType: R(e)
    }, a = this._parseSync({ data: e, path: r.path, parent: r });
    return xe(r, a);
  }
  "~validate"(e) {
    var r, a;
    const t = {
      common: {
        issues: [],
        async: !!this["~standard"].async
      },
      path: [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data: e,
      parsedType: R(e)
    };
    if (!this["~standard"].async)
      try {
        const s = this._parseSync({ data: e, path: [], parent: t });
        return z(s) ? {
          value: s.value
        } : {
          issues: t.common.issues
        };
      } catch (s) {
        (a = (r = s == null ? void 0 : s.message) == null ? void 0 : r.toLowerCase()) != null && a.includes("encountered") && (this["~standard"].async = !0), t.common = {
          issues: [],
          async: !0
        };
      }
    return this._parseAsync({ data: e, path: [], parent: t }).then((s) => z(s) ? {
      value: s.value
    } : {
      issues: t.common.issues
    });
  }
  async parseAsync(e, t) {
    const r = await this.safeParseAsync(e, t);
    if (r.success)
      return r.data;
    throw r.error;
  }
  async safeParseAsync(e, t) {
    const r = {
      common: {
        issues: [],
        contextualErrorMap: t == null ? void 0 : t.errorMap,
        async: !0
      },
      path: (t == null ? void 0 : t.path) || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data: e,
      parsedType: R(e)
    }, a = this._parse({ data: e, path: r.path, parent: r }), s = await (X(a) ? a : Promise.resolve(a));
    return xe(r, s);
  }
  refine(e, t) {
    const r = (a) => typeof t == "string" || typeof t > "u" ? { message: t } : typeof t == "function" ? t(a) : t;
    return this._refinement((a, s) => {
      const i = e(a), o = () => s.addIssue({
        code: l.custom,
        ...r(a)
      });
      return typeof Promise < "u" && i instanceof Promise ? i.then((u) => u ? !0 : (o(), !1)) : i ? !0 : (o(), !1);
    });
  }
  refinement(e, t) {
    return this._refinement((r, a) => e(r) ? !0 : (a.addIssue(typeof t == "function" ? t(r, a) : t), !1));
  }
  _refinement(e) {
    return new M({
      schema: this,
      typeName: m.ZodEffects,
      effect: { type: "refinement", refinement: e }
    });
  }
  superRefine(e) {
    return this._refinement(e);
  }
  constructor(e) {
    this.spa = this.safeParseAsync, this._def = e, this.parse = this.parse.bind(this), this.safeParse = this.safeParse.bind(this), this.parseAsync = this.parseAsync.bind(this), this.safeParseAsync = this.safeParseAsync.bind(this), this.spa = this.spa.bind(this), this.refine = this.refine.bind(this), this.refinement = this.refinement.bind(this), this.superRefine = this.superRefine.bind(this), this.optional = this.optional.bind(this), this.nullable = this.nullable.bind(this), this.nullish = this.nullish.bind(this), this.array = this.array.bind(this), this.promise = this.promise.bind(this), this.or = this.or.bind(this), this.and = this.and.bind(this), this.transform = this.transform.bind(this), this.brand = this.brand.bind(this), this.default = this.default.bind(this), this.catch = this.catch.bind(this), this.describe = this.describe.bind(this), this.pipe = this.pipe.bind(this), this.readonly = this.readonly.bind(this), this.isNullable = this.isNullable.bind(this), this.isOptional = this.isOptional.bind(this), this["~standard"] = {
      version: 1,
      vendor: "zod",
      validate: (t) => this["~validate"](t)
    };
  }
  optional() {
    return Z.create(this, this._def);
  }
  nullable() {
    return B.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return C.create(this);
  }
  promise() {
    return ae.create(this, this._def);
  }
  or(e) {
    return te.create([this, e], this._def);
  }
  and(e) {
    return ne.create(this, e, this._def);
  }
  transform(e) {
    return new M({
      ...g(this._def),
      schema: this,
      typeName: m.ZodEffects,
      effect: { type: "transform", transform: e }
    });
  }
  default(e) {
    const t = typeof e == "function" ? e : () => e;
    return new he({
      ...g(this._def),
      innerType: this,
      defaultValue: t,
      typeName: m.ZodDefault
    });
  }
  brand() {
    return new wt({
      typeName: m.ZodBranded,
      type: this,
      ...g(this._def)
    });
  }
  catch(e) {
    const t = typeof e == "function" ? e : () => e;
    return new fe({
      ...g(this._def),
      innerType: this,
      catchValue: t,
      typeName: m.ZodCatch
    });
  }
  describe(e) {
    const t = this.constructor;
    return new t({
      ...this._def,
      description: e
    });
  }
  pipe(e) {
    return me.create(this, e);
  }
  readonly() {
    return pe.create(this);
  }
  isOptional() {
    return this.safeParse(void 0).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
}
const tt = /^c[^\s-]{8,}$/i, nt = /^[0-9a-z]+$/, rt = /^[0-9A-HJKMNP-TV-Z]{26}$/i, at = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i, st = /^[a-z0-9_-]{21}$/i, it = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/, ot = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/, lt = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i, ct = "^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$";
let ie;
const dt = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/, ut = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/, ht = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/, ft = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/, pt = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/, mt = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/, je = "((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))", _t = new RegExp(`^${je}$`);
function $e(n) {
  let e = "[0-5]\\d";
  n.precision ? e = `${e}\\.\\d{${n.precision}}` : n.precision == null && (e = `${e}(\\.\\d+)?`);
  const t = n.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${e})${t}`;
}
function gt(n) {
  return new RegExp(`^${$e(n)}$`);
}
function yt(n) {
  let e = `${je}T${$e(n)}`;
  const t = [];
  return t.push(n.local ? "Z?" : "Z"), n.offset && t.push("([+-]\\d{2}:?\\d{2})"), e = `${e}(${t.join("|")})`, new RegExp(`^${e}$`);
}
function vt(n, e) {
  return !!((e === "v4" || !e) && dt.test(n) || (e === "v6" || !e) && ht.test(n));
}
function bt(n, e) {
  if (!it.test(n))
    return !1;
  try {
    const [t] = n.split(".");
    if (!t)
      return !1;
    const r = t.replace(/-/g, "+").replace(/_/g, "/").padEnd(t.length + (4 - t.length % 4) % 4, "="), a = JSON.parse(atob(r));
    return !(typeof a != "object" || a === null || "typ" in a && (a == null ? void 0 : a.typ) !== "JWT" || !a.alg || e && a.alg !== e);
  } catch {
    return !1;
  }
}
function kt(n, e) {
  return !!((e === "v4" || !e) && ut.test(n) || (e === "v6" || !e) && ft.test(n));
}
class A extends v {
  _parse(e) {
    if (this._def.coerce && (e.data = String(e.data)), this._getType(e) !== d.string) {
      const s = this._getOrReturnCtx(e);
      return c(s, {
        code: l.invalid_type,
        expected: d.string,
        received: s.parsedType
      }), _;
    }
    const r = new w();
    let a;
    for (const s of this._def.checks)
      if (s.kind === "min")
        e.data.length < s.value && (a = this._getOrReturnCtx(e, a), c(a, {
          code: l.too_small,
          minimum: s.value,
          type: "string",
          inclusive: !0,
          exact: !1,
          message: s.message
        }), r.dirty());
      else if (s.kind === "max")
        e.data.length > s.value && (a = this._getOrReturnCtx(e, a), c(a, {
          code: l.too_big,
          maximum: s.value,
          type: "string",
          inclusive: !0,
          exact: !1,
          message: s.message
        }), r.dirty());
      else if (s.kind === "length") {
        const i = e.data.length > s.value, o = e.data.length < s.value;
        (i || o) && (a = this._getOrReturnCtx(e, a), i ? c(a, {
          code: l.too_big,
          maximum: s.value,
          type: "string",
          inclusive: !0,
          exact: !0,
          message: s.message
        }) : o && c(a, {
          code: l.too_small,
          minimum: s.value,
          type: "string",
          inclusive: !0,
          exact: !0,
          message: s.message
        }), r.dirty());
      } else if (s.kind === "email")
        lt.test(e.data) || (a = this._getOrReturnCtx(e, a), c(a, {
          validation: "email",
          code: l.invalid_string,
          message: s.message
        }), r.dirty());
      else if (s.kind === "emoji")
        ie || (ie = new RegExp(ct, "u")), ie.test(e.data) || (a = this._getOrReturnCtx(e, a), c(a, {
          validation: "emoji",
          code: l.invalid_string,
          message: s.message
        }), r.dirty());
      else if (s.kind === "uuid")
        at.test(e.data) || (a = this._getOrReturnCtx(e, a), c(a, {
          validation: "uuid",
          code: l.invalid_string,
          message: s.message
        }), r.dirty());
      else if (s.kind === "nanoid")
        st.test(e.data) || (a = this._getOrReturnCtx(e, a), c(a, {
          validation: "nanoid",
          code: l.invalid_string,
          message: s.message
        }), r.dirty());
      else if (s.kind === "cuid")
        tt.test(e.data) || (a = this._getOrReturnCtx(e, a), c(a, {
          validation: "cuid",
          code: l.invalid_string,
          message: s.message
        }), r.dirty());
      else if (s.kind === "cuid2")
        nt.test(e.data) || (a = this._getOrReturnCtx(e, a), c(a, {
          validation: "cuid2",
          code: l.invalid_string,
          message: s.message
        }), r.dirty());
      else if (s.kind === "ulid")
        rt.test(e.data) || (a = this._getOrReturnCtx(e, a), c(a, {
          validation: "ulid",
          code: l.invalid_string,
          message: s.message
        }), r.dirty());
      else if (s.kind === "url")
        try {
          new URL(e.data);
        } catch {
          a = this._getOrReturnCtx(e, a), c(a, {
            validation: "url",
            code: l.invalid_string,
            message: s.message
          }), r.dirty();
        }
      else s.kind === "regex" ? (s.regex.lastIndex = 0, s.regex.test(e.data) || (a = this._getOrReturnCtx(e, a), c(a, {
        validation: "regex",
        code: l.invalid_string,
        message: s.message
      }), r.dirty())) : s.kind === "trim" ? e.data = e.data.trim() : s.kind === "includes" ? e.data.includes(s.value, s.position) || (a = this._getOrReturnCtx(e, a), c(a, {
        code: l.invalid_string,
        validation: { includes: s.value, position: s.position },
        message: s.message
      }), r.dirty()) : s.kind === "toLowerCase" ? e.data = e.data.toLowerCase() : s.kind === "toUpperCase" ? e.data = e.data.toUpperCase() : s.kind === "startsWith" ? e.data.startsWith(s.value) || (a = this._getOrReturnCtx(e, a), c(a, {
        code: l.invalid_string,
        validation: { startsWith: s.value },
        message: s.message
      }), r.dirty()) : s.kind === "endsWith" ? e.data.endsWith(s.value) || (a = this._getOrReturnCtx(e, a), c(a, {
        code: l.invalid_string,
        validation: { endsWith: s.value },
        message: s.message
      }), r.dirty()) : s.kind === "datetime" ? yt(s).test(e.data) || (a = this._getOrReturnCtx(e, a), c(a, {
        code: l.invalid_string,
        validation: "datetime",
        message: s.message
      }), r.dirty()) : s.kind === "date" ? _t.test(e.data) || (a = this._getOrReturnCtx(e, a), c(a, {
        code: l.invalid_string,
        validation: "date",
        message: s.message
      }), r.dirty()) : s.kind === "time" ? gt(s).test(e.data) || (a = this._getOrReturnCtx(e, a), c(a, {
        code: l.invalid_string,
        validation: "time",
        message: s.message
      }), r.dirty()) : s.kind === "duration" ? ot.test(e.data) || (a = this._getOrReturnCtx(e, a), c(a, {
        validation: "duration",
        code: l.invalid_string,
        message: s.message
      }), r.dirty()) : s.kind === "ip" ? vt(e.data, s.version) || (a = this._getOrReturnCtx(e, a), c(a, {
        validation: "ip",
        code: l.invalid_string,
        message: s.message
      }), r.dirty()) : s.kind === "jwt" ? bt(e.data, s.alg) || (a = this._getOrReturnCtx(e, a), c(a, {
        validation: "jwt",
        code: l.invalid_string,
        message: s.message
      }), r.dirty()) : s.kind === "cidr" ? kt(e.data, s.version) || (a = this._getOrReturnCtx(e, a), c(a, {
        validation: "cidr",
        code: l.invalid_string,
        message: s.message
      }), r.dirty()) : s.kind === "base64" ? pt.test(e.data) || (a = this._getOrReturnCtx(e, a), c(a, {
        validation: "base64",
        code: l.invalid_string,
        message: s.message
      }), r.dirty()) : s.kind === "base64url" ? mt.test(e.data) || (a = this._getOrReturnCtx(e, a), c(a, {
        validation: "base64url",
        code: l.invalid_string,
        message: s.message
      }), r.dirty()) : b.assertNever(s);
    return { status: r.value, value: e.data };
  }
  _regex(e, t, r) {
    return this.refinement((a) => e.test(a), {
      validation: t,
      code: l.invalid_string,
      ...f.errToObj(r)
    });
  }
  _addCheck(e) {
    return new A({
      ...this._def,
      checks: [...this._def.checks, e]
    });
  }
  email(e) {
    return this._addCheck({ kind: "email", ...f.errToObj(e) });
  }
  url(e) {
    return this._addCheck({ kind: "url", ...f.errToObj(e) });
  }
  emoji(e) {
    return this._addCheck({ kind: "emoji", ...f.errToObj(e) });
  }
  uuid(e) {
    return this._addCheck({ kind: "uuid", ...f.errToObj(e) });
  }
  nanoid(e) {
    return this._addCheck({ kind: "nanoid", ...f.errToObj(e) });
  }
  cuid(e) {
    return this._addCheck({ kind: "cuid", ...f.errToObj(e) });
  }
  cuid2(e) {
    return this._addCheck({ kind: "cuid2", ...f.errToObj(e) });
  }
  ulid(e) {
    return this._addCheck({ kind: "ulid", ...f.errToObj(e) });
  }
  base64(e) {
    return this._addCheck({ kind: "base64", ...f.errToObj(e) });
  }
  base64url(e) {
    return this._addCheck({
      kind: "base64url",
      ...f.errToObj(e)
    });
  }
  jwt(e) {
    return this._addCheck({ kind: "jwt", ...f.errToObj(e) });
  }
  ip(e) {
    return this._addCheck({ kind: "ip", ...f.errToObj(e) });
  }
  cidr(e) {
    return this._addCheck({ kind: "cidr", ...f.errToObj(e) });
  }
  datetime(e) {
    return typeof e == "string" ? this._addCheck({
      kind: "datetime",
      precision: null,
      offset: !1,
      local: !1,
      message: e
    }) : this._addCheck({
      kind: "datetime",
      precision: typeof (e == null ? void 0 : e.precision) > "u" ? null : e == null ? void 0 : e.precision,
      offset: (e == null ? void 0 : e.offset) ?? !1,
      local: (e == null ? void 0 : e.local) ?? !1,
      ...f.errToObj(e == null ? void 0 : e.message)
    });
  }
  date(e) {
    return this._addCheck({ kind: "date", message: e });
  }
  time(e) {
    return typeof e == "string" ? this._addCheck({
      kind: "time",
      precision: null,
      message: e
    }) : this._addCheck({
      kind: "time",
      precision: typeof (e == null ? void 0 : e.precision) > "u" ? null : e == null ? void 0 : e.precision,
      ...f.errToObj(e == null ? void 0 : e.message)
    });
  }
  duration(e) {
    return this._addCheck({ kind: "duration", ...f.errToObj(e) });
  }
  regex(e, t) {
    return this._addCheck({
      kind: "regex",
      regex: e,
      ...f.errToObj(t)
    });
  }
  includes(e, t) {
    return this._addCheck({
      kind: "includes",
      value: e,
      position: t == null ? void 0 : t.position,
      ...f.errToObj(t == null ? void 0 : t.message)
    });
  }
  startsWith(e, t) {
    return this._addCheck({
      kind: "startsWith",
      value: e,
      ...f.errToObj(t)
    });
  }
  endsWith(e, t) {
    return this._addCheck({
      kind: "endsWith",
      value: e,
      ...f.errToObj(t)
    });
  }
  min(e, t) {
    return this._addCheck({
      kind: "min",
      value: e,
      ...f.errToObj(t)
    });
  }
  max(e, t) {
    return this._addCheck({
      kind: "max",
      value: e,
      ...f.errToObj(t)
    });
  }
  length(e, t) {
    return this._addCheck({
      kind: "length",
      value: e,
      ...f.errToObj(t)
    });
  }
  /**
   * Equivalent to `.min(1)`
   */
  nonempty(e) {
    return this.min(1, f.errToObj(e));
  }
  trim() {
    return new A({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }]
    });
  }
  toLowerCase() {
    return new A({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }]
    });
  }
  toUpperCase() {
    return new A({
      ...this._def,
      checks: [...this._def.checks, { kind: "toUpperCase" }]
    });
  }
  get isDatetime() {
    return !!this._def.checks.find((e) => e.kind === "datetime");
  }
  get isDate() {
    return !!this._def.checks.find((e) => e.kind === "date");
  }
  get isTime() {
    return !!this._def.checks.find((e) => e.kind === "time");
  }
  get isDuration() {
    return !!this._def.checks.find((e) => e.kind === "duration");
  }
  get isEmail() {
    return !!this._def.checks.find((e) => e.kind === "email");
  }
  get isURL() {
    return !!this._def.checks.find((e) => e.kind === "url");
  }
  get isEmoji() {
    return !!this._def.checks.find((e) => e.kind === "emoji");
  }
  get isUUID() {
    return !!this._def.checks.find((e) => e.kind === "uuid");
  }
  get isNANOID() {
    return !!this._def.checks.find((e) => e.kind === "nanoid");
  }
  get isCUID() {
    return !!this._def.checks.find((e) => e.kind === "cuid");
  }
  get isCUID2() {
    return !!this._def.checks.find((e) => e.kind === "cuid2");
  }
  get isULID() {
    return !!this._def.checks.find((e) => e.kind === "ulid");
  }
  get isIP() {
    return !!this._def.checks.find((e) => e.kind === "ip");
  }
  get isCIDR() {
    return !!this._def.checks.find((e) => e.kind === "cidr");
  }
  get isBase64() {
    return !!this._def.checks.find((e) => e.kind === "base64");
  }
  get isBase64url() {
    return !!this._def.checks.find((e) => e.kind === "base64url");
  }
  get minLength() {
    let e = null;
    for (const t of this._def.checks)
      t.kind === "min" && (e === null || t.value > e) && (e = t.value);
    return e;
  }
  get maxLength() {
    let e = null;
    for (const t of this._def.checks)
      t.kind === "max" && (e === null || t.value < e) && (e = t.value);
    return e;
  }
}
A.create = (n) => new A({
  checks: [],
  typeName: m.ZodString,
  coerce: (n == null ? void 0 : n.coerce) ?? !1,
  ...g(n)
});
function xt(n, e) {
  const t = (n.toString().split(".")[1] || "").length, r = (e.toString().split(".")[1] || "").length, a = t > r ? t : r, s = Number.parseInt(n.toFixed(a).replace(".", "")), i = Number.parseInt(e.toFixed(a).replace(".", ""));
  return s % i / 10 ** a;
}
class V extends v {
  constructor() {
    super(...arguments), this.min = this.gte, this.max = this.lte, this.step = this.multipleOf;
  }
  _parse(e) {
    if (this._def.coerce && (e.data = Number(e.data)), this._getType(e) !== d.number) {
      const s = this._getOrReturnCtx(e);
      return c(s, {
        code: l.invalid_type,
        expected: d.number,
        received: s.parsedType
      }), _;
    }
    let r;
    const a = new w();
    for (const s of this._def.checks)
      s.kind === "int" ? b.isInteger(e.data) || (r = this._getOrReturnCtx(e, r), c(r, {
        code: l.invalid_type,
        expected: "integer",
        received: "float",
        message: s.message
      }), a.dirty()) : s.kind === "min" ? (s.inclusive ? e.data < s.value : e.data <= s.value) && (r = this._getOrReturnCtx(e, r), c(r, {
        code: l.too_small,
        minimum: s.value,
        type: "number",
        inclusive: s.inclusive,
        exact: !1,
        message: s.message
      }), a.dirty()) : s.kind === "max" ? (s.inclusive ? e.data > s.value : e.data >= s.value) && (r = this._getOrReturnCtx(e, r), c(r, {
        code: l.too_big,
        maximum: s.value,
        type: "number",
        inclusive: s.inclusive,
        exact: !1,
        message: s.message
      }), a.dirty()) : s.kind === "multipleOf" ? xt(e.data, s.value) !== 0 && (r = this._getOrReturnCtx(e, r), c(r, {
        code: l.not_multiple_of,
        multipleOf: s.value,
        message: s.message
      }), a.dirty()) : s.kind === "finite" ? Number.isFinite(e.data) || (r = this._getOrReturnCtx(e, r), c(r, {
        code: l.not_finite,
        message: s.message
      }), a.dirty()) : b.assertNever(s);
    return { status: a.value, value: e.data };
  }
  gte(e, t) {
    return this.setLimit("min", e, !0, f.toString(t));
  }
  gt(e, t) {
    return this.setLimit("min", e, !1, f.toString(t));
  }
  lte(e, t) {
    return this.setLimit("max", e, !0, f.toString(t));
  }
  lt(e, t) {
    return this.setLimit("max", e, !1, f.toString(t));
  }
  setLimit(e, t, r, a) {
    return new V({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind: e,
          value: t,
          inclusive: r,
          message: f.toString(a)
        }
      ]
    });
  }
  _addCheck(e) {
    return new V({
      ...this._def,
      checks: [...this._def.checks, e]
    });
  }
  int(e) {
    return this._addCheck({
      kind: "int",
      message: f.toString(e)
    });
  }
  positive(e) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: !1,
      message: f.toString(e)
    });
  }
  negative(e) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: !1,
      message: f.toString(e)
    });
  }
  nonpositive(e) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: !0,
      message: f.toString(e)
    });
  }
  nonnegative(e) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: !0,
      message: f.toString(e)
    });
  }
  multipleOf(e, t) {
    return this._addCheck({
      kind: "multipleOf",
      value: e,
      message: f.toString(t)
    });
  }
  finite(e) {
    return this._addCheck({
      kind: "finite",
      message: f.toString(e)
    });
  }
  safe(e) {
    return this._addCheck({
      kind: "min",
      inclusive: !0,
      value: Number.MIN_SAFE_INTEGER,
      message: f.toString(e)
    })._addCheck({
      kind: "max",
      inclusive: !0,
      value: Number.MAX_SAFE_INTEGER,
      message: f.toString(e)
    });
  }
  get minValue() {
    let e = null;
    for (const t of this._def.checks)
      t.kind === "min" && (e === null || t.value > e) && (e = t.value);
    return e;
  }
  get maxValue() {
    let e = null;
    for (const t of this._def.checks)
      t.kind === "max" && (e === null || t.value < e) && (e = t.value);
    return e;
  }
  get isInt() {
    return !!this._def.checks.find((e) => e.kind === "int" || e.kind === "multipleOf" && b.isInteger(e.value));
  }
  get isFinite() {
    let e = null, t = null;
    for (const r of this._def.checks) {
      if (r.kind === "finite" || r.kind === "int" || r.kind === "multipleOf")
        return !0;
      r.kind === "min" ? (t === null || r.value > t) && (t = r.value) : r.kind === "max" && (e === null || r.value < e) && (e = r.value);
    }
    return Number.isFinite(t) && Number.isFinite(e);
  }
}
V.create = (n) => new V({
  checks: [],
  typeName: m.ZodNumber,
  coerce: (n == null ? void 0 : n.coerce) || !1,
  ...g(n)
});
class H extends v {
  constructor() {
    super(...arguments), this.min = this.gte, this.max = this.lte;
  }
  _parse(e) {
    if (this._def.coerce)
      try {
        e.data = BigInt(e.data);
      } catch {
        return this._getInvalidInput(e);
      }
    if (this._getType(e) !== d.bigint)
      return this._getInvalidInput(e);
    let r;
    const a = new w();
    for (const s of this._def.checks)
      s.kind === "min" ? (s.inclusive ? e.data < s.value : e.data <= s.value) && (r = this._getOrReturnCtx(e, r), c(r, {
        code: l.too_small,
        type: "bigint",
        minimum: s.value,
        inclusive: s.inclusive,
        message: s.message
      }), a.dirty()) : s.kind === "max" ? (s.inclusive ? e.data > s.value : e.data >= s.value) && (r = this._getOrReturnCtx(e, r), c(r, {
        code: l.too_big,
        type: "bigint",
        maximum: s.value,
        inclusive: s.inclusive,
        message: s.message
      }), a.dirty()) : s.kind === "multipleOf" ? e.data % s.value !== BigInt(0) && (r = this._getOrReturnCtx(e, r), c(r, {
        code: l.not_multiple_of,
        multipleOf: s.value,
        message: s.message
      }), a.dirty()) : b.assertNever(s);
    return { status: a.value, value: e.data };
  }
  _getInvalidInput(e) {
    const t = this._getOrReturnCtx(e);
    return c(t, {
      code: l.invalid_type,
      expected: d.bigint,
      received: t.parsedType
    }), _;
  }
  gte(e, t) {
    return this.setLimit("min", e, !0, f.toString(t));
  }
  gt(e, t) {
    return this.setLimit("min", e, !1, f.toString(t));
  }
  lte(e, t) {
    return this.setLimit("max", e, !0, f.toString(t));
  }
  lt(e, t) {
    return this.setLimit("max", e, !1, f.toString(t));
  }
  setLimit(e, t, r, a) {
    return new H({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind: e,
          value: t,
          inclusive: r,
          message: f.toString(a)
        }
      ]
    });
  }
  _addCheck(e) {
    return new H({
      ...this._def,
      checks: [...this._def.checks, e]
    });
  }
  positive(e) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: !1,
      message: f.toString(e)
    });
  }
  negative(e) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: !1,
      message: f.toString(e)
    });
  }
  nonpositive(e) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: !0,
      message: f.toString(e)
    });
  }
  nonnegative(e) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: !0,
      message: f.toString(e)
    });
  }
  multipleOf(e, t) {
    return this._addCheck({
      kind: "multipleOf",
      value: e,
      message: f.toString(t)
    });
  }
  get minValue() {
    let e = null;
    for (const t of this._def.checks)
      t.kind === "min" && (e === null || t.value > e) && (e = t.value);
    return e;
  }
  get maxValue() {
    let e = null;
    for (const t of this._def.checks)
      t.kind === "max" && (e === null || t.value < e) && (e = t.value);
    return e;
  }
}
H.create = (n) => new H({
  checks: [],
  typeName: m.ZodBigInt,
  coerce: (n == null ? void 0 : n.coerce) ?? !1,
  ...g(n)
});
class ce extends v {
  _parse(e) {
    if (this._def.coerce && (e.data = !!e.data), this._getType(e) !== d.boolean) {
      const r = this._getOrReturnCtx(e);
      return c(r, {
        code: l.invalid_type,
        expected: d.boolean,
        received: r.parsedType
      }), _;
    }
    return S(e.data);
  }
}
ce.create = (n) => new ce({
  typeName: m.ZodBoolean,
  coerce: (n == null ? void 0 : n.coerce) || !1,
  ...g(n)
});
class ee extends v {
  _parse(e) {
    if (this._def.coerce && (e.data = new Date(e.data)), this._getType(e) !== d.date) {
      const s = this._getOrReturnCtx(e);
      return c(s, {
        code: l.invalid_type,
        expected: d.date,
        received: s.parsedType
      }), _;
    }
    if (Number.isNaN(e.data.getTime())) {
      const s = this._getOrReturnCtx(e);
      return c(s, {
        code: l.invalid_date
      }), _;
    }
    const r = new w();
    let a;
    for (const s of this._def.checks)
      s.kind === "min" ? e.data.getTime() < s.value && (a = this._getOrReturnCtx(e, a), c(a, {
        code: l.too_small,
        message: s.message,
        inclusive: !0,
        exact: !1,
        minimum: s.value,
        type: "date"
      }), r.dirty()) : s.kind === "max" ? e.data.getTime() > s.value && (a = this._getOrReturnCtx(e, a), c(a, {
        code: l.too_big,
        message: s.message,
        inclusive: !0,
        exact: !1,
        maximum: s.value,
        type: "date"
      }), r.dirty()) : b.assertNever(s);
    return {
      status: r.value,
      value: new Date(e.data.getTime())
    };
  }
  _addCheck(e) {
    return new ee({
      ...this._def,
      checks: [...this._def.checks, e]
    });
  }
  min(e, t) {
    return this._addCheck({
      kind: "min",
      value: e.getTime(),
      message: f.toString(t)
    });
  }
  max(e, t) {
    return this._addCheck({
      kind: "max",
      value: e.getTime(),
      message: f.toString(t)
    });
  }
  get minDate() {
    let e = null;
    for (const t of this._def.checks)
      t.kind === "min" && (e === null || t.value > e) && (e = t.value);
    return e != null ? new Date(e) : null;
  }
  get maxDate() {
    let e = null;
    for (const t of this._def.checks)
      t.kind === "max" && (e === null || t.value < e) && (e = t.value);
    return e != null ? new Date(e) : null;
  }
}
ee.create = (n) => new ee({
  checks: [],
  coerce: (n == null ? void 0 : n.coerce) || !1,
  typeName: m.ZodDate,
  ...g(n)
});
class we extends v {
  _parse(e) {
    if (this._getType(e) !== d.symbol) {
      const r = this._getOrReturnCtx(e);
      return c(r, {
        code: l.invalid_type,
        expected: d.symbol,
        received: r.parsedType
      }), _;
    }
    return S(e.data);
  }
}
we.create = (n) => new we({
  typeName: m.ZodSymbol,
  ...g(n)
});
class Se extends v {
  _parse(e) {
    if (this._getType(e) !== d.undefined) {
      const r = this._getOrReturnCtx(e);
      return c(r, {
        code: l.invalid_type,
        expected: d.undefined,
        received: r.parsedType
      }), _;
    }
    return S(e.data);
  }
}
Se.create = (n) => new Se({
  typeName: m.ZodUndefined,
  ...g(n)
});
class Te extends v {
  _parse(e) {
    if (this._getType(e) !== d.null) {
      const r = this._getOrReturnCtx(e);
      return c(r, {
        code: l.invalid_type,
        expected: d.null,
        received: r.parsedType
      }), _;
    }
    return S(e.data);
  }
}
Te.create = (n) => new Te({
  typeName: m.ZodNull,
  ...g(n)
});
class Ce extends v {
  constructor() {
    super(...arguments), this._any = !0;
  }
  _parse(e) {
    return S(e.data);
  }
}
Ce.create = (n) => new Ce({
  typeName: m.ZodAny,
  ...g(n)
});
class de extends v {
  constructor() {
    super(...arguments), this._unknown = !0;
  }
  _parse(e) {
    return S(e.data);
  }
}
de.create = (n) => new de({
  typeName: m.ZodUnknown,
  ...g(n)
});
class j extends v {
  _parse(e) {
    const t = this._getOrReturnCtx(e);
    return c(t, {
      code: l.invalid_type,
      expected: d.never,
      received: t.parsedType
    }), _;
  }
}
j.create = (n) => new j({
  typeName: m.ZodNever,
  ...g(n)
});
class Ee extends v {
  _parse(e) {
    if (this._getType(e) !== d.undefined) {
      const r = this._getOrReturnCtx(e);
      return c(r, {
        code: l.invalid_type,
        expected: d.void,
        received: r.parsedType
      }), _;
    }
    return S(e.data);
  }
}
Ee.create = (n) => new Ee({
  typeName: m.ZodVoid,
  ...g(n)
});
class C extends v {
  _parse(e) {
    const { ctx: t, status: r } = this._processInputParams(e), a = this._def;
    if (t.parsedType !== d.array)
      return c(t, {
        code: l.invalid_type,
        expected: d.array,
        received: t.parsedType
      }), _;
    if (a.exactLength !== null) {
      const i = t.data.length > a.exactLength.value, o = t.data.length < a.exactLength.value;
      (i || o) && (c(t, {
        code: i ? l.too_big : l.too_small,
        minimum: o ? a.exactLength.value : void 0,
        maximum: i ? a.exactLength.value : void 0,
        type: "array",
        inclusive: !0,
        exact: !0,
        message: a.exactLength.message
      }), r.dirty());
    }
    if (a.minLength !== null && t.data.length < a.minLength.value && (c(t, {
      code: l.too_small,
      minimum: a.minLength.value,
      type: "array",
      inclusive: !0,
      exact: !1,
      message: a.minLength.message
    }), r.dirty()), a.maxLength !== null && t.data.length > a.maxLength.value && (c(t, {
      code: l.too_big,
      maximum: a.maxLength.value,
      type: "array",
      inclusive: !0,
      exact: !1,
      message: a.maxLength.message
    }), r.dirty()), t.common.async)
      return Promise.all([...t.data].map((i, o) => a.type._parseAsync(new I(t, i, t.path, o)))).then((i) => w.mergeArray(r, i));
    const s = [...t.data].map((i, o) => a.type._parseSync(new I(t, i, t.path, o)));
    return w.mergeArray(r, s);
  }
  get element() {
    return this._def.type;
  }
  min(e, t) {
    return new C({
      ...this._def,
      minLength: { value: e, message: f.toString(t) }
    });
  }
  max(e, t) {
    return new C({
      ...this._def,
      maxLength: { value: e, message: f.toString(t) }
    });
  }
  length(e, t) {
    return new C({
      ...this._def,
      exactLength: { value: e, message: f.toString(t) }
    });
  }
  nonempty(e) {
    return this.min(1, e);
  }
}
C.create = (n, e) => new C({
  type: n,
  minLength: null,
  maxLength: null,
  exactLength: null,
  typeName: m.ZodArray,
  ...g(e)
});
function P(n) {
  if (n instanceof x) {
    const e = {};
    for (const t in n.shape) {
      const r = n.shape[t];
      e[t] = Z.create(P(r));
    }
    return new x({
      ...n._def,
      shape: () => e
    });
  } else return n instanceof C ? new C({
    ...n._def,
    type: P(n.element)
  }) : n instanceof Z ? Z.create(P(n.unwrap())) : n instanceof B ? B.create(P(n.unwrap())) : n instanceof $ ? $.create(n.items.map((e) => P(e))) : n;
}
class x extends v {
  constructor() {
    super(...arguments), this._cached = null, this.nonstrict = this.passthrough, this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null)
      return this._cached;
    const e = this._def.shape(), t = b.objectKeys(e);
    return this._cached = { shape: e, keys: t }, this._cached;
  }
  _parse(e) {
    if (this._getType(e) !== d.object) {
      const h = this._getOrReturnCtx(e);
      return c(h, {
        code: l.invalid_type,
        expected: d.object,
        received: h.parsedType
      }), _;
    }
    const { status: r, ctx: a } = this._processInputParams(e), { shape: s, keys: i } = this._getCached(), o = [];
    if (!(this._def.catchall instanceof j && this._def.unknownKeys === "strip"))
      for (const h in a.data)
        i.includes(h) || o.push(h);
    const u = [];
    for (const h of i) {
      const y = s[h], N = a.data[h];
      u.push({
        key: { status: "valid", value: h },
        value: y._parse(new I(a, N, a.path, h)),
        alwaysSet: h in a.data
      });
    }
    if (this._def.catchall instanceof j) {
      const h = this._def.unknownKeys;
      if (h === "passthrough")
        for (const y of o)
          u.push({
            key: { status: "valid", value: y },
            value: { status: "valid", value: a.data[y] }
          });
      else if (h === "strict")
        o.length > 0 && (c(a, {
          code: l.unrecognized_keys,
          keys: o
        }), r.dirty());
      else if (h !== "strip") throw new Error("Internal ZodObject error: invalid unknownKeys value.");
    } else {
      const h = this._def.catchall;
      for (const y of o) {
        const N = a.data[y];
        u.push({
          key: { status: "valid", value: y },
          value: h._parse(
            new I(a, N, a.path, y)
            //, ctx.child(key), value, getParsedType(value)
          ),
          alwaysSet: y in a.data
        });
      }
    }
    return a.common.async ? Promise.resolve().then(async () => {
      const h = [];
      for (const y of u) {
        const N = await y.key, Fe = await y.value;
        h.push({
          key: N,
          value: Fe,
          alwaysSet: y.alwaysSet
        });
      }
      return h;
    }).then((h) => w.mergeObjectSync(r, h)) : w.mergeObjectSync(r, u);
  }
  get shape() {
    return this._def.shape();
  }
  strict(e) {
    return f.errToObj, new x({
      ...this._def,
      unknownKeys: "strict",
      ...e !== void 0 ? {
        errorMap: (t, r) => {
          var s, i;
          const a = ((i = (s = this._def).errorMap) == null ? void 0 : i.call(s, t, r).message) ?? r.defaultError;
          return t.code === "unrecognized_keys" ? {
            message: f.errToObj(e).message ?? a
          } : {
            message: a
          };
        }
      } : {}
    });
  }
  strip() {
    return new x({
      ...this._def,
      unknownKeys: "strip"
    });
  }
  passthrough() {
    return new x({
      ...this._def,
      unknownKeys: "passthrough"
    });
  }
  // const AugmentFactory =
  //   <Def extends ZodObjectDef>(def: Def) =>
  //   <Augmentation extends ZodRawShape>(
  //     augmentation: Augmentation
  //   ): ZodObject<
  //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
  //     Def["unknownKeys"],
  //     Def["catchall"]
  //   > => {
  //     return new ZodObject({
  //       ...def,
  //       shape: () => ({
  //         ...def.shape(),
  //         ...augmentation,
  //       }),
  //     }) as any;
  //   };
  extend(e) {
    return new x({
      ...this._def,
      shape: () => ({
        ...this._def.shape(),
        ...e
      })
    });
  }
  /**
   * Prior to zod@1.0.12 there was a bug in the
   * inferred type of merged objects. Please
   * upgrade if you are experiencing issues.
   */
  merge(e) {
    return new x({
      unknownKeys: e._def.unknownKeys,
      catchall: e._def.catchall,
      shape: () => ({
        ...this._def.shape(),
        ...e._def.shape()
      }),
      typeName: m.ZodObject
    });
  }
  // merge<
  //   Incoming extends AnyZodObject,
  //   Augmentation extends Incoming["shape"],
  //   NewOutput extends {
  //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
  //       ? Augmentation[k]["_output"]
  //       : k extends keyof Output
  //       ? Output[k]
  //       : never;
  //   },
  //   NewInput extends {
  //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
  //       ? Augmentation[k]["_input"]
  //       : k extends keyof Input
  //       ? Input[k]
  //       : never;
  //   }
  // >(
  //   merging: Incoming
  // ): ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"],
  //   NewOutput,
  //   NewInput
  // > {
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  setKey(e, t) {
    return this.augment({ [e]: t });
  }
  // merge<Incoming extends AnyZodObject>(
  //   merging: Incoming
  // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
  // ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"]
  // > {
  //   // const mergedShape = objectUtil.mergeShapes(
  //   //   this._def.shape(),
  //   //   merging._def.shape()
  //   // );
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  catchall(e) {
    return new x({
      ...this._def,
      catchall: e
    });
  }
  pick(e) {
    const t = {};
    for (const r of b.objectKeys(e))
      e[r] && this.shape[r] && (t[r] = this.shape[r]);
    return new x({
      ...this._def,
      shape: () => t
    });
  }
  omit(e) {
    const t = {};
    for (const r of b.objectKeys(this.shape))
      e[r] || (t[r] = this.shape[r]);
    return new x({
      ...this._def,
      shape: () => t
    });
  }
  /**
   * @deprecated
   */
  deepPartial() {
    return P(this);
  }
  partial(e) {
    const t = {};
    for (const r of b.objectKeys(this.shape)) {
      const a = this.shape[r];
      e && !e[r] ? t[r] = a : t[r] = a.optional();
    }
    return new x({
      ...this._def,
      shape: () => t
    });
  }
  required(e) {
    const t = {};
    for (const r of b.objectKeys(this.shape))
      if (e && !e[r])
        t[r] = this.shape[r];
      else {
        let s = this.shape[r];
        for (; s instanceof Z; )
          s = s._def.innerType;
        t[r] = s;
      }
    return new x({
      ...this._def,
      shape: () => t
    });
  }
  keyof() {
    return Me(b.objectKeys(this.shape));
  }
}
x.create = (n, e) => new x({
  shape: () => n,
  unknownKeys: "strip",
  catchall: j.create(),
  typeName: m.ZodObject,
  ...g(e)
});
x.strictCreate = (n, e) => new x({
  shape: () => n,
  unknownKeys: "strict",
  catchall: j.create(),
  typeName: m.ZodObject,
  ...g(e)
});
x.lazycreate = (n, e) => new x({
  shape: n,
  unknownKeys: "strip",
  catchall: j.create(),
  typeName: m.ZodObject,
  ...g(e)
});
class te extends v {
  _parse(e) {
    const { ctx: t } = this._processInputParams(e), r = this._def.options;
    function a(s) {
      for (const o of s)
        if (o.result.status === "valid")
          return o.result;
      for (const o of s)
        if (o.result.status === "dirty")
          return t.common.issues.push(...o.ctx.common.issues), o.result;
      const i = s.map((o) => new O(o.ctx.common.issues));
      return c(t, {
        code: l.invalid_union,
        unionErrors: i
      }), _;
    }
    if (t.common.async)
      return Promise.all(r.map(async (s) => {
        const i = {
          ...t,
          common: {
            ...t.common,
            issues: []
          },
          parent: null
        };
        return {
          result: await s._parseAsync({
            data: t.data,
            path: t.path,
            parent: i
          }),
          ctx: i
        };
      })).then(a);
    {
      let s;
      const i = [];
      for (const u of r) {
        const h = {
          ...t,
          common: {
            ...t.common,
            issues: []
          },
          parent: null
        }, y = u._parseSync({
          data: t.data,
          path: t.path,
          parent: h
        });
        if (y.status === "valid")
          return y;
        y.status === "dirty" && !s && (s = { result: y, ctx: h }), h.common.issues.length && i.push(h.common.issues);
      }
      if (s)
        return t.common.issues.push(...s.ctx.common.issues), s.result;
      const o = i.map((u) => new O(u));
      return c(t, {
        code: l.invalid_union,
        unionErrors: o
      }), _;
    }
  }
  get options() {
    return this._def.options;
  }
}
te.create = (n, e) => new te({
  options: n,
  typeName: m.ZodUnion,
  ...g(e)
});
function ue(n, e) {
  const t = R(n), r = R(e);
  if (n === e)
    return { valid: !0, data: n };
  if (t === d.object && r === d.object) {
    const a = b.objectKeys(e), s = b.objectKeys(n).filter((o) => a.indexOf(o) !== -1), i = { ...n, ...e };
    for (const o of s) {
      const u = ue(n[o], e[o]);
      if (!u.valid)
        return { valid: !1 };
      i[o] = u.data;
    }
    return { valid: !0, data: i };
  } else if (t === d.array && r === d.array) {
    if (n.length !== e.length)
      return { valid: !1 };
    const a = [];
    for (let s = 0; s < n.length; s++) {
      const i = n[s], o = e[s], u = ue(i, o);
      if (!u.valid)
        return { valid: !1 };
      a.push(u.data);
    }
    return { valid: !0, data: a };
  } else return t === d.date && r === d.date && +n == +e ? { valid: !0, data: n } : { valid: !1 };
}
class ne extends v {
  _parse(e) {
    const { status: t, ctx: r } = this._processInputParams(e), a = (s, i) => {
      if (be(s) || be(i))
        return _;
      const o = ue(s.value, i.value);
      return o.valid ? ((ke(s) || ke(i)) && t.dirty(), { status: t.value, value: o.data }) : (c(r, {
        code: l.invalid_intersection_types
      }), _);
    };
    return r.common.async ? Promise.all([
      this._def.left._parseAsync({
        data: r.data,
        path: r.path,
        parent: r
      }),
      this._def.right._parseAsync({
        data: r.data,
        path: r.path,
        parent: r
      })
    ]).then(([s, i]) => a(s, i)) : a(this._def.left._parseSync({
      data: r.data,
      path: r.path,
      parent: r
    }), this._def.right._parseSync({
      data: r.data,
      path: r.path,
      parent: r
    }));
  }
}
ne.create = (n, e, t) => new ne({
  left: n,
  right: e,
  typeName: m.ZodIntersection,
  ...g(t)
});
class $ extends v {
  _parse(e) {
    const { status: t, ctx: r } = this._processInputParams(e);
    if (r.parsedType !== d.array)
      return c(r, {
        code: l.invalid_type,
        expected: d.array,
        received: r.parsedType
      }), _;
    if (r.data.length < this._def.items.length)
      return c(r, {
        code: l.too_small,
        minimum: this._def.items.length,
        inclusive: !0,
        exact: !1,
        type: "array"
      }), _;
    !this._def.rest && r.data.length > this._def.items.length && (c(r, {
      code: l.too_big,
      maximum: this._def.items.length,
      inclusive: !0,
      exact: !1,
      type: "array"
    }), t.dirty());
    const s = [...r.data].map((i, o) => {
      const u = this._def.items[o] || this._def.rest;
      return u ? u._parse(new I(r, i, r.path, o)) : null;
    }).filter((i) => !!i);
    return r.common.async ? Promise.all(s).then((i) => w.mergeArray(t, i)) : w.mergeArray(t, s);
  }
  get items() {
    return this._def.items;
  }
  rest(e) {
    return new $({
      ...this._def,
      rest: e
    });
  }
}
$.create = (n, e) => {
  if (!Array.isArray(n))
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  return new $({
    items: n,
    typeName: m.ZodTuple,
    rest: null,
    ...g(e)
  });
};
class re extends v {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(e) {
    const { status: t, ctx: r } = this._processInputParams(e);
    if (r.parsedType !== d.object)
      return c(r, {
        code: l.invalid_type,
        expected: d.object,
        received: r.parsedType
      }), _;
    const a = [], s = this._def.keyType, i = this._def.valueType;
    for (const o in r.data)
      a.push({
        key: s._parse(new I(r, o, r.path, o)),
        value: i._parse(new I(r, r.data[o], r.path, o)),
        alwaysSet: o in r.data
      });
    return r.common.async ? w.mergeObjectAsync(t, a) : w.mergeObjectSync(t, a);
  }
  get element() {
    return this._def.valueType;
  }
  static create(e, t, r) {
    return t instanceof v ? new re({
      keyType: e,
      valueType: t,
      typeName: m.ZodRecord,
      ...g(r)
    }) : new re({
      keyType: A.create(),
      valueType: e,
      typeName: m.ZodRecord,
      ...g(t)
    });
  }
}
class Ie extends v {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(e) {
    const { status: t, ctx: r } = this._processInputParams(e);
    if (r.parsedType !== d.map)
      return c(r, {
        code: l.invalid_type,
        expected: d.map,
        received: r.parsedType
      }), _;
    const a = this._def.keyType, s = this._def.valueType, i = [...r.data.entries()].map(([o, u], h) => ({
      key: a._parse(new I(r, o, r.path, [h, "key"])),
      value: s._parse(new I(r, u, r.path, [h, "value"]))
    }));
    if (r.common.async) {
      const o = /* @__PURE__ */ new Map();
      return Promise.resolve().then(async () => {
        for (const u of i) {
          const h = await u.key, y = await u.value;
          if (h.status === "aborted" || y.status === "aborted")
            return _;
          (h.status === "dirty" || y.status === "dirty") && t.dirty(), o.set(h.value, y.value);
        }
        return { status: t.value, value: o };
      });
    } else {
      const o = /* @__PURE__ */ new Map();
      for (const u of i) {
        const h = u.key, y = u.value;
        if (h.status === "aborted" || y.status === "aborted")
          return _;
        (h.status === "dirty" || y.status === "dirty") && t.dirty(), o.set(h.value, y.value);
      }
      return { status: t.value, value: o };
    }
  }
}
Ie.create = (n, e, t) => new Ie({
  valueType: e,
  keyType: n,
  typeName: m.ZodMap,
  ...g(t)
});
class J extends v {
  _parse(e) {
    const { status: t, ctx: r } = this._processInputParams(e);
    if (r.parsedType !== d.set)
      return c(r, {
        code: l.invalid_type,
        expected: d.set,
        received: r.parsedType
      }), _;
    const a = this._def;
    a.minSize !== null && r.data.size < a.minSize.value && (c(r, {
      code: l.too_small,
      minimum: a.minSize.value,
      type: "set",
      inclusive: !0,
      exact: !1,
      message: a.minSize.message
    }), t.dirty()), a.maxSize !== null && r.data.size > a.maxSize.value && (c(r, {
      code: l.too_big,
      maximum: a.maxSize.value,
      type: "set",
      inclusive: !0,
      exact: !1,
      message: a.maxSize.message
    }), t.dirty());
    const s = this._def.valueType;
    function i(u) {
      const h = /* @__PURE__ */ new Set();
      for (const y of u) {
        if (y.status === "aborted")
          return _;
        y.status === "dirty" && t.dirty(), h.add(y.value);
      }
      return { status: t.value, value: h };
    }
    const o = [...r.data.values()].map((u, h) => s._parse(new I(r, u, r.path, h)));
    return r.common.async ? Promise.all(o).then((u) => i(u)) : i(o);
  }
  min(e, t) {
    return new J({
      ...this._def,
      minSize: { value: e, message: f.toString(t) }
    });
  }
  max(e, t) {
    return new J({
      ...this._def,
      maxSize: { value: e, message: f.toString(t) }
    });
  }
  size(e, t) {
    return this.min(e, t).max(e, t);
  }
  nonempty(e) {
    return this.min(1, e);
  }
}
J.create = (n, e) => new J({
  valueType: n,
  minSize: null,
  maxSize: null,
  typeName: m.ZodSet,
  ...g(e)
});
class qe extends v {
  get schema() {
    return this._def.getter();
  }
  _parse(e) {
    const { ctx: t } = this._processInputParams(e);
    return this._def.getter()._parse({ data: t.data, path: t.path, parent: t });
  }
}
qe.create = (n, e) => new qe({
  getter: n,
  typeName: m.ZodLazy,
  ...g(e)
});
class Ae extends v {
  _parse(e) {
    if (e.data !== this._def.value) {
      const t = this._getOrReturnCtx(e);
      return c(t, {
        received: t.data,
        code: l.invalid_literal,
        expected: this._def.value
      }), _;
    }
    return { status: "valid", value: e.data };
  }
  get value() {
    return this._def.value;
  }
}
Ae.create = (n, e) => new Ae({
  value: n,
  typeName: m.ZodLiteral,
  ...g(e)
});
function Me(n, e) {
  return new D({
    values: n,
    typeName: m.ZodEnum,
    ...g(e)
  });
}
class D extends v {
  _parse(e) {
    if (typeof e.data != "string") {
      const t = this._getOrReturnCtx(e), r = this._def.values;
      return c(t, {
        expected: b.joinValues(r),
        received: t.parsedType,
        code: l.invalid_type
      }), _;
    }
    if (this._cache || (this._cache = new Set(this._def.values)), !this._cache.has(e.data)) {
      const t = this._getOrReturnCtx(e), r = this._def.values;
      return c(t, {
        received: t.data,
        code: l.invalid_enum_value,
        options: r
      }), _;
    }
    return S(e.data);
  }
  get options() {
    return this._def.values;
  }
  get enum() {
    const e = {};
    for (const t of this._def.values)
      e[t] = t;
    return e;
  }
  get Values() {
    const e = {};
    for (const t of this._def.values)
      e[t] = t;
    return e;
  }
  get Enum() {
    const e = {};
    for (const t of this._def.values)
      e[t] = t;
    return e;
  }
  extract(e, t = this._def) {
    return D.create(e, {
      ...this._def,
      ...t
    });
  }
  exclude(e, t = this._def) {
    return D.create(this.options.filter((r) => !e.includes(r)), {
      ...this._def,
      ...t
    });
  }
}
D.create = Me;
class Oe extends v {
  _parse(e) {
    const t = b.getValidEnumValues(this._def.values), r = this._getOrReturnCtx(e);
    if (r.parsedType !== d.string && r.parsedType !== d.number) {
      const a = b.objectValues(t);
      return c(r, {
        expected: b.joinValues(a),
        received: r.parsedType,
        code: l.invalid_type
      }), _;
    }
    if (this._cache || (this._cache = new Set(b.getValidEnumValues(this._def.values))), !this._cache.has(e.data)) {
      const a = b.objectValues(t);
      return c(r, {
        received: r.data,
        code: l.invalid_enum_value,
        options: a
      }), _;
    }
    return S(e.data);
  }
  get enum() {
    return this._def.values;
  }
}
Oe.create = (n, e) => new Oe({
  values: n,
  typeName: m.ZodNativeEnum,
  ...g(e)
});
class ae extends v {
  unwrap() {
    return this._def.type;
  }
  _parse(e) {
    const { ctx: t } = this._processInputParams(e);
    if (t.parsedType !== d.promise && t.common.async === !1)
      return c(t, {
        code: l.invalid_type,
        expected: d.promise,
        received: t.parsedType
      }), _;
    const r = t.parsedType === d.promise ? t.data : Promise.resolve(t.data);
    return S(r.then((a) => this._def.type.parseAsync(a, {
      path: t.path,
      errorMap: t.common.contextualErrorMap
    })));
  }
}
ae.create = (n, e) => new ae({
  type: n,
  typeName: m.ZodPromise,
  ...g(e)
});
class M extends v {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === m.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(e) {
    const { status: t, ctx: r } = this._processInputParams(e), a = this._def.effect || null, s = {
      addIssue: (i) => {
        c(r, i), i.fatal ? t.abort() : t.dirty();
      },
      get path() {
        return r.path;
      }
    };
    if (s.addIssue = s.addIssue.bind(s), a.type === "preprocess") {
      const i = a.transform(r.data, s);
      if (r.common.async)
        return Promise.resolve(i).then(async (o) => {
          if (t.value === "aborted")
            return _;
          const u = await this._def.schema._parseAsync({
            data: o,
            path: r.path,
            parent: r
          });
          return u.status === "aborted" ? _ : u.status === "dirty" || t.value === "dirty" ? U(u.value) : u;
        });
      {
        if (t.value === "aborted")
          return _;
        const o = this._def.schema._parseSync({
          data: i,
          path: r.path,
          parent: r
        });
        return o.status === "aborted" ? _ : o.status === "dirty" || t.value === "dirty" ? U(o.value) : o;
      }
    }
    if (a.type === "refinement") {
      const i = (o) => {
        const u = a.refinement(o, s);
        if (r.common.async)
          return Promise.resolve(u);
        if (u instanceof Promise)
          throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        return o;
      };
      if (r.common.async === !1) {
        const o = this._def.schema._parseSync({
          data: r.data,
          path: r.path,
          parent: r
        });
        return o.status === "aborted" ? _ : (o.status === "dirty" && t.dirty(), i(o.value), { status: t.value, value: o.value });
      } else
        return this._def.schema._parseAsync({ data: r.data, path: r.path, parent: r }).then((o) => o.status === "aborted" ? _ : (o.status === "dirty" && t.dirty(), i(o.value).then(() => ({ status: t.value, value: o.value }))));
    }
    if (a.type === "transform")
      if (r.common.async === !1) {
        const i = this._def.schema._parseSync({
          data: r.data,
          path: r.path,
          parent: r
        });
        if (!z(i))
          return _;
        const o = a.transform(i.value, s);
        if (o instanceof Promise)
          throw new Error("Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.");
        return { status: t.value, value: o };
      } else
        return this._def.schema._parseAsync({ data: r.data, path: r.path, parent: r }).then((i) => z(i) ? Promise.resolve(a.transform(i.value, s)).then((o) => ({
          status: t.value,
          value: o
        })) : _);
    b.assertNever(a);
  }
}
M.create = (n, e, t) => new M({
  schema: n,
  typeName: m.ZodEffects,
  effect: e,
  ...g(t)
});
M.createWithPreprocess = (n, e, t) => new M({
  schema: e,
  effect: { type: "preprocess", transform: n },
  typeName: m.ZodEffects,
  ...g(t)
});
class Z extends v {
  _parse(e) {
    return this._getType(e) === d.undefined ? S(void 0) : this._def.innerType._parse(e);
  }
  unwrap() {
    return this._def.innerType;
  }
}
Z.create = (n, e) => new Z({
  innerType: n,
  typeName: m.ZodOptional,
  ...g(e)
});
class B extends v {
  _parse(e) {
    return this._getType(e) === d.null ? S(null) : this._def.innerType._parse(e);
  }
  unwrap() {
    return this._def.innerType;
  }
}
B.create = (n, e) => new B({
  innerType: n,
  typeName: m.ZodNullable,
  ...g(e)
});
class he extends v {
  _parse(e) {
    const { ctx: t } = this._processInputParams(e);
    let r = t.data;
    return t.parsedType === d.undefined && (r = this._def.defaultValue()), this._def.innerType._parse({
      data: r,
      path: t.path,
      parent: t
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
}
he.create = (n, e) => new he({
  innerType: n,
  typeName: m.ZodDefault,
  defaultValue: typeof e.default == "function" ? e.default : () => e.default,
  ...g(e)
});
class fe extends v {
  _parse(e) {
    const { ctx: t } = this._processInputParams(e), r = {
      ...t,
      common: {
        ...t.common,
        issues: []
      }
    }, a = this._def.innerType._parse({
      data: r.data,
      path: r.path,
      parent: {
        ...r
      }
    });
    return X(a) ? a.then((s) => ({
      status: "valid",
      value: s.status === "valid" ? s.value : this._def.catchValue({
        get error() {
          return new O(r.common.issues);
        },
        input: r.data
      })
    })) : {
      status: "valid",
      value: a.status === "valid" ? a.value : this._def.catchValue({
        get error() {
          return new O(r.common.issues);
        },
        input: r.data
      })
    };
  }
  removeCatch() {
    return this._def.innerType;
  }
}
fe.create = (n, e) => new fe({
  innerType: n,
  typeName: m.ZodCatch,
  catchValue: typeof e.catch == "function" ? e.catch : () => e.catch,
  ...g(e)
});
class Ne extends v {
  _parse(e) {
    if (this._getType(e) !== d.nan) {
      const r = this._getOrReturnCtx(e);
      return c(r, {
        code: l.invalid_type,
        expected: d.nan,
        received: r.parsedType
      }), _;
    }
    return { status: "valid", value: e.data };
  }
}
Ne.create = (n) => new Ne({
  typeName: m.ZodNaN,
  ...g(n)
});
class wt extends v {
  _parse(e) {
    const { ctx: t } = this._processInputParams(e), r = t.data;
    return this._def.type._parse({
      data: r,
      path: t.path,
      parent: t
    });
  }
  unwrap() {
    return this._def.type;
  }
}
class me extends v {
  _parse(e) {
    const { status: t, ctx: r } = this._processInputParams(e);
    if (r.common.async)
      return (async () => {
        const s = await this._def.in._parseAsync({
          data: r.data,
          path: r.path,
          parent: r
        });
        return s.status === "aborted" ? _ : s.status === "dirty" ? (t.dirty(), U(s.value)) : this._def.out._parseAsync({
          data: s.value,
          path: r.path,
          parent: r
        });
      })();
    {
      const a = this._def.in._parseSync({
        data: r.data,
        path: r.path,
        parent: r
      });
      return a.status === "aborted" ? _ : a.status === "dirty" ? (t.dirty(), {
        status: "dirty",
        value: a.value
      }) : this._def.out._parseSync({
        data: a.value,
        path: r.path,
        parent: r
      });
    }
  }
  static create(e, t) {
    return new me({
      in: e,
      out: t,
      typeName: m.ZodPipeline
    });
  }
}
class pe extends v {
  _parse(e) {
    const t = this._def.innerType._parse(e), r = (a) => (z(a) && (a.value = Object.freeze(a.value)), a);
    return X(t) ? t.then((a) => r(a)) : r(t);
  }
  unwrap() {
    return this._def.innerType;
  }
}
pe.create = (n, e) => new pe({
  innerType: n,
  typeName: m.ZodReadonly,
  ...g(e)
});
var m;
(function(n) {
  n.ZodString = "ZodString", n.ZodNumber = "ZodNumber", n.ZodNaN = "ZodNaN", n.ZodBigInt = "ZodBigInt", n.ZodBoolean = "ZodBoolean", n.ZodDate = "ZodDate", n.ZodSymbol = "ZodSymbol", n.ZodUndefined = "ZodUndefined", n.ZodNull = "ZodNull", n.ZodAny = "ZodAny", n.ZodUnknown = "ZodUnknown", n.ZodNever = "ZodNever", n.ZodVoid = "ZodVoid", n.ZodArray = "ZodArray", n.ZodObject = "ZodObject", n.ZodUnion = "ZodUnion", n.ZodDiscriminatedUnion = "ZodDiscriminatedUnion", n.ZodIntersection = "ZodIntersection", n.ZodTuple = "ZodTuple", n.ZodRecord = "ZodRecord", n.ZodMap = "ZodMap", n.ZodSet = "ZodSet", n.ZodFunction = "ZodFunction", n.ZodLazy = "ZodLazy", n.ZodLiteral = "ZodLiteral", n.ZodEnum = "ZodEnum", n.ZodEffects = "ZodEffects", n.ZodNativeEnum = "ZodNativeEnum", n.ZodOptional = "ZodOptional", n.ZodNullable = "ZodNullable", n.ZodDefault = "ZodDefault", n.ZodCatch = "ZodCatch", n.ZodPromise = "ZodPromise", n.ZodBranded = "ZodBranded", n.ZodPipeline = "ZodPipeline", n.ZodReadonly = "ZodReadonly";
})(m || (m = {}));
const p = A.create, Q = V.create, _e = ce.create, ge = de.create;
j.create;
const E = C.create, T = x.create;
te.create;
ne.create;
$.create;
const G = re.create, q = D.create;
ae.create;
Z.create;
B.create;
const Le = M.createWithPreprocess, St = q(["log", "span", "metric"]), Tt = q(["ok", "error", "unset"]), Ct = q(["counter", "gauge", "histogram", "summary"]), Et = q([
  "json",
  "rpc",
  "protobuf",
  "text",
  "binary",
  "stream"
]), It = q(["raw", "base64", "gzip+base64", "protobuf"]), qt = T({
  log_id: p().min(1),
  timestamp: p().datetime(),
  record_kind: St,
  trace_id: p().min(1),
  span_id: p().min(1),
  parent_span_id: p().optional(),
  event_key: p().min(1),
  event_version: p().regex(/^\d{3}$/),
  span_name: p().optional(),
  start_time: p().datetime().optional(),
  end_time: p().datetime().optional(),
  status_code: Tt.optional(),
  payload_format: Et,
  payload_encoding: It,
  payload_masking_applied: _e(),
  payload_masked_fields: E(p()),
  payload: ge(),
  qa_session_id: p().optional(),
  // Address context
  address_context: G(p(), p()).optional(),
  // Metric (when record_kind === "metric")
  metric_type: Ct.optional(),
  metric_name: p().optional(),
  metric_value: Q().optional(),
  metric_unit: p().optional(),
  metric_labels: G(p(), p()).optional(),
  metric_buckets: E(Q()).optional(),
  metric_quantiles: E(Q()).optional(),
  actor_id: p().optional(),
  user_id: p().optional(),
  user_attributes: G(p()).optional()
}), At = q([
  "tenant",
  "workspace",
  "user",
  "agent"
]), Ot = T({
  owner_type: At,
  owner_id: p().min(1)
}), Nt = T({
  service_name: p().min(1),
  sdk_name: p().min(1),
  sdk_version: p().min(1)
}), Rt = T({
  platform: p().min(1),
  device_ref: p().optional(),
  os_version: p().optional(),
  app_version: p().optional()
}), Zt = p().min(1), jt = T({
  env: Zt,
  build_ref: p().optional(),
  release_version: p().optional()
});
T({
  transmission_id: p().min(1),
  sent_at: p().datetime(),
  owner: Ot,
  source: Nt,
  runtime: Rt,
  build: jt,
  infra_context: G(p(), p()).optional(),
  entry_snapshot: p().optional(),
  records: E(qt).min(1)
});
const $t = q([
  "eq",
  "neq",
  "exists",
  "gt",
  "lt",
  "contains",
  "masked"
]), Pe = T({
  field: p().min(1),
  op: $t,
  value: ge().optional()
}), Mt = T({
  field: p().min(1),
  op: q(["eq", "neq", "exists", "gt", "lt", "contains"]),
  value: ge().optional()
}), Lt = T({
  condition: Pe,
  next: E(p().min(1))
}), Pt = q(["sequence", "optional", "branch"]), zt = T({
  id: p().min(1),
  event_key: p().min(1),
  event_version: p().regex(/^\d{3}$/).optional(),
  source: p().optional(),
  record_kind: q(["log", "span"]).optional(),
  required: _e(),
  kind: Pt,
  constraints: E(Pe).optional(),
  timeout_ms: Q().int().positive().optional(),
  next: E(p().min(1)).optional(),
  branches: E(Lt).optional()
});
T({
  scenario_id: p().min(1),
  version: p().min(1),
  domain: p().min(1),
  description: p().optional(),
  entry_conditions: E(Mt).optional(),
  steps: E(zt).min(1)
});
function Y(n) {
  const e = new Error(n);
  return e.source = "ulid", e;
}
const ye = "0123456789ABCDEFGHJKMNPQRSTVWXYZ", W = ye.length, Re = Math.pow(2, 48) - 1, Vt = 10, Dt = 16;
function Bt(n) {
  let e = Math.floor(n() * W);
  return e === W && (e = W - 1), ye.charAt(e);
}
function Ft(n, e) {
  if (isNaN(n))
    throw new Error(n + " must be a number");
  if (n > Re)
    throw Y("cannot encode time greater than " + Re);
  if (n < 0)
    throw Y("time must be positive");
  if (Number.isInteger(Number(n)) === !1)
    throw Y("time must be an integer");
  let t, r = "";
  for (; e > 0; e--)
    t = n % W, r = ye.charAt(t) + r, n = (n - t) / W;
  return r;
}
function Ut(n, e) {
  let t = "";
  for (; n > 0; n--)
    t = Bt(e) + t;
  return t;
}
function Wt(n = !1, e) {
  e || (e = typeof window < "u" ? window : null);
  const t = e && (e.crypto || e.msCrypto);
  if (t)
    return () => {
      const r = new Uint8Array(1);
      return t.getRandomValues(r), r[0] / 255;
    };
  try {
    const r = require("crypto");
    return () => r.randomBytes(1).readUInt8() / 255;
  } catch {
  }
  if (n) {
    try {
      console.error("secure crypto unusable, falling back to insecure Math.random()!");
    } catch {
    }
    return () => Math.random();
  }
  throw Y("secure crypto unusable, insecure Math.random not allowed");
}
function Ht(n) {
  return n || (n = Wt()), function(t) {
    return isNaN(t) && (t = Date.now()), Ft(t, Vt) + Ut(Dt, n);
  };
}
const K = Ht();
function Jt() {
  return `txm_${K()}`;
}
function oe() {
  return `log_${K()}`;
}
function ze() {
  return `trc_${K()}`;
}
function Kt() {
  return `spn_${K()}`;
}
function Qt() {
  return `qas_${K()}`;
}
function L() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
const Gt = (n) => typeof n == "string" && n.trim().length === 0 ? void 0 : n;
Le(Gt, p().url().optional());
Le((n) => {
  if (typeof n == "boolean")
    return n;
  if (typeof n == "string") {
    const e = n.trim().toLowerCase();
    if (e.length === 0)
      return;
    if (e === "true")
      return !0;
    if (e === "false")
      return !1;
  }
  return n;
}, _e().default(!1));
class se {
  constructor(e) {
    k(this, "trace_id");
    k(this, "spanStack", []);
    k(this, "qa_session_id");
    this.trace_id = (e == null ? void 0 : e.trace_id) ?? ze(), this.qa_session_id = e == null ? void 0 : e.qa_session_id;
  }
  /** Push a new span onto the stack. Returns the new span_id. */
  pushSpan(e) {
    const t = e ?? Kt();
    return this.spanStack.push(t), t;
  }
  /** Pop the current span. Returns the popped span_id or undefined. */
  popSpan() {
    return this.spanStack.pop();
  }
  /** Current (deepest) span_id, or generates a new one if stack is empty. */
  get currentSpanId() {
    return this.spanStack.length === 0 ? this.pushSpan() : this.spanStack[this.spanStack.length - 1];
  }
  /** Parent span_id (one level above current), or undefined if at root. */
  get parentSpanId() {
    if (!(this.spanStack.length < 2))
      return this.spanStack[this.spanStack.length - 2];
  }
  /** Current stack depth. */
  get depth() {
    return this.spanStack.length;
  }
}
function Yt(n, e) {
  const t = { ...n }, r = [];
  for (const a of e)
    if (a.field in t)
      switch (r.push(a.field), a.mode) {
        case "raw":
          break;
        case "mask": {
          const s = {
            _masked: !0,
            _present: t[a.field] !== void 0 && t[a.field] !== null
          };
          t[a.field] = s;
          break;
        }
        case "drop":
          delete t[a.field];
          break;
        case "hash": {
          const s = t[a.field];
          t[a.field] = Xt(String(s));
          break;
        }
      }
  return { masked: t, maskedFields: r };
}
function Xt(n) {
  let e = 0;
  for (let t = 0; t < n.length; t++) {
    const r = n.charCodeAt(t);
    e = (e << 5) - e + r | 0;
  }
  return `h_${(e >>> 0).toString(16).padStart(8, "0")}`;
}
const en = 50, tn = 5e3, nn = 500;
class rn {
  constructor(e) {
    k(this, "config");
    k(this, "batchSize");
    k(this, "flushIntervalMs");
    k(this, "maxBufferSize");
    k(this, "buffer", []);
    k(this, "flushTimer", null);
    k(this, "activeContext", null);
    k(this, "actor", null);
    /** Prevents concurrent flush calls (interval + batch-size trigger). */
    k(this, "flushInProgress", !1);
    this.config = e, this.batchSize = e.batchSize ?? en, this.flushIntervalMs = e.flushIntervalMs ?? tn, this.maxBufferSize = e.maxBufferSize ?? nn, this.flushIntervalMs > 0 && (this.flushTimer = setInterval(() => {
      this.flush().catch((t) => this.handleError(t, "interval-flush"));
    }, this.flushIntervalMs)), e.actor && (this.actor = e.actor);
  }
  // ── Context Management ─────────────────────────────
  /** Start a new trace context (or attach to existing trace). */
  startTrace(e) {
    return this.activeContext = new se(e), this.activeContext;
  }
  /** Get the current trace context. */
  get context() {
    return this.activeContext;
  }
  // ── Actor ───────────────────────────────────────────
  /** Set actor context. 이후 emit되는 모든 레코드에 자동 주입된다. */
  setActor(e) {
    this.actor = e;
  }
  /** Clear actor context. */
  clearActor() {
    this.actor = null;
  }
  /** Set an external trace context (e.g., propagated from upstream). */
  setContext(e) {
    this.activeContext = e;
  }
  // ── Log ────────────────────────────────────────────
  /** Record a log event. */
  log(e) {
    const t = this.ensureContext(), { payload: r, maskedFields: a, maskingApplied: s } = this.processPayload(e.payload), i = {
      log_id: oe(),
      timestamp: L(),
      record_kind: "log",
      trace_id: t.trace_id,
      span_id: t.currentSpanId,
      parent_span_id: t.parentSpanId,
      event_key: e.event_key,
      event_version: e.event_version,
      payload_format: e.payload_format ?? "json",
      payload_encoding: e.payload_encoding ?? "raw",
      payload_masking_applied: s,
      payload_masked_fields: a,
      payload: r,
      qa_session_id: e.qa_session_id ?? t.qa_session_id,
      ...e.address_context ? { address_context: e.address_context } : {},
      ...this.actorFields()
    };
    return this.addRecord(i), i;
  }
  // ── Span ───────────────────────────────────────────
  /** Start a span. Returns a handle to end it. */
  startSpan(e) {
    const t = this.ensureContext(), r = t.pushSpan(), a = t.parentSpanId, s = L();
    return {
      span_id: r,
      end: (i) => {
        t.popSpan();
        const o = {
          ...e.payload,
          ...i == null ? void 0 : i.payload
        }, { payload: u, maskedFields: h, maskingApplied: y } = this.processPayload(Object.keys(o).length > 0 ? o : void 0), N = {
          log_id: oe(),
          timestamp: L(),
          record_kind: "span",
          trace_id: t.trace_id,
          span_id: r,
          parent_span_id: a,
          event_key: e.event_key,
          event_version: e.event_version,
          span_name: e.span_name,
          start_time: s,
          end_time: L(),
          status_code: (i == null ? void 0 : i.status_code) ?? "ok",
          payload_format: e.payload_format ?? "json",
          payload_encoding: e.payload_encoding ?? "raw",
          payload_masking_applied: y,
          payload_masked_fields: h,
          payload: u,
          qa_session_id: e.qa_session_id ?? t.qa_session_id,
          ...e.address_context ? { address_context: e.address_context } : {},
          ...this.actorFields()
        };
        return this.addRecord(N), N;
      }
    };
  }
  // ── Metric ──────────────────────────────────────────
  /** Record a metric event. */
  metric(e, t, r) {
    const a = this.ensureContext(), s = {
      log_id: oe(),
      timestamp: L(),
      record_kind: "metric",
      trace_id: a.trace_id,
      span_id: a.currentSpanId,
      parent_span_id: a.parentSpanId,
      event_key: e,
      event_version: "1",
      payload_format: "json",
      payload_encoding: "raw",
      payload_masking_applied: !1,
      payload_masked_fields: [],
      payload: null,
      qa_session_id: a.qa_session_id,
      metric_type: (r == null ? void 0 : r.type) ?? "gauge",
      metric_name: e,
      metric_value: t,
      ...r != null && r.unit ? { metric_unit: r.unit } : {},
      ...r != null && r.labels ? { metric_labels: r.labels } : {},
      ...r != null && r.buckets ? { metric_buckets: r.buckets } : {},
      ...r != null && r.quantiles ? { metric_quantiles: r.quantiles } : {},
      ...r != null && r.address_context ? { address_context: r.address_context } : {},
      ...this.actorFields()
    };
    return this.addRecord(s), s;
  }
  // ── Flush / Shutdown ───────────────────────────────
  /** Flush buffered records as a transmission envelope. */
  async flush() {
    if (this.flushInProgress || this.buffer.length === 0)
      return;
    this.flushInProgress = !0;
    const e = this.buffer.splice(0, this.buffer.length);
    try {
      const t = this.buildEnvelope(e);
      await this.config.transport.send(t);
    } catch (t) {
      const r = [...e, ...this.buffer];
      if (r.length > this.maxBufferSize) {
        const s = r.splice(0, r.length - this.maxBufferSize);
        this.handleError(new Error(`[qa-sdk:flush] buffer overflow — dropped ${s.length} oldest records`), "buffer-overflow");
      }
      this.buffer = r;
      const a = t instanceof Error ? t : new Error(String(t));
      throw new Error(`[qa-sdk:flush] transport.send failed: ${a.message}`, { cause: a });
    } finally {
      this.flushInProgress = !1;
    }
  }
  /** Flush remaining records and shut down. */
  async shutdown() {
    this.flushTimer && (clearInterval(this.flushTimer), this.flushTimer = null), await this.flush(), await this.config.transport.shutdown();
  }
  // ── Internal ───────────────────────────────────────
  ensureContext() {
    return this.activeContext || (this.activeContext = new se()), this.activeContext;
  }
  processPayload(e) {
    if (!e)
      return { payload: null, maskedFields: [], maskingApplied: !1 };
    const t = this.config.maskingRules;
    if (!t || t.length === 0)
      return { payload: e, maskedFields: [], maskingApplied: !1 };
    const { masked: r, maskedFields: a } = Yt(e, t);
    return {
      payload: r,
      maskedFields: a,
      maskingApplied: a.length > 0
    };
  }
  addRecord(e) {
    this.buffer.length >= this.maxBufferSize && (this.buffer.shift(), this.handleError(new Error(`[qa-sdk:addRecord] buffer at cap (${this.maxBufferSize}) — dropping oldest record`), "buffer-overflow")), this.buffer.push(e), !this.flushInProgress && this.buffer.length >= this.batchSize && this.flush().catch((t) => this.handleError(t, "batch-flush"));
  }
  handleError(e, t) {
    const r = e instanceof Error ? e : new Error(String(e));
    this.config.onError ? this.config.onError(r, t) : console.error(`[qa-sdk:${t}]`, r);
  }
  actorFields() {
    return this.actor ? {
      actor_id: this.actor.actor_id,
      ...this.actor.user_id !== void 0 ? { user_id: this.actor.user_id } : {},
      ...this.actor.user_attributes !== void 0 ? { user_attributes: this.actor.user_attributes } : {}
    } : {};
  }
  buildEnvelope(e) {
    return {
      transmission_id: Jt(),
      sent_at: L(),
      owner: this.config.owner,
      source: this.config.source,
      runtime: this.config.runtime,
      build: this.config.build,
      ...this.config.infraContext ? { infra_context: this.config.infraContext } : {},
      ...this.config.entrySnapshot ? { entry_snapshot: this.config.entrySnapshot } : {},
      records: e
    };
  }
}
function F(n) {
  var t;
  if (!n.name) throw new RangeError("PackFormat: name is required");
  if (n.chars <= 0) throw new RangeError(`PackFormat "${n.name}": chars must be > 0`);
  const e = (t = n.groups) != null && t.length ? Object.freeze([...n.groups]) : void 0;
  if (e) {
    const r = e.reduce((a, s) => a + s, 0);
    if (r !== n.chars)
      throw new RangeError(
        `PackFormat "${n.name}": groups sum (${r}) ≠ chars (${n.chars})`
      );
    if (e.some((a) => a <= 0))
      throw new RangeError(`PackFormat "${n.name}": each group must be > 0`);
  }
  return Object.freeze({
    name: n.name,
    chars: n.chars,
    bits: n.chars * 4,
    label: n.label,
    groups: e
  });
}
F({ name: "int64", chars: 16, label: "64-bit Integer" }), F({ name: "objectId", chars: 24, label: "96-bit ObjectId" }), F({ name: "uuid", chars: 32, label: "UUID (128-bit)", groups: [8, 4, 4, 4, 12] }), F({ name: "sha1", chars: 40, label: "160-bit (SHA-1)" }), F({ name: "sha256", chars: 64, label: "256-bit (SHA-256)" });
const an = [
  {
    event_key: "page_view",
    event_version: "1",
    mode: "core",
    category: "navigation",
    channel: ["browser"],
    display_name: "페이지 진입",
    description: "웹 페이지 진입",
    auto_collectable: !0,
    graph_hint: { role: "entry", goal_eligible: !1, loopable: !0 }
  },
  {
    event_key: "screen_view",
    event_version: "1",
    mode: "core",
    category: "navigation",
    channel: ["mobile"],
    display_name: "화면 진입",
    description: "앱 화면 진입",
    auto_collectable: !0,
    graph_hint: { role: "entry", goal_eligible: !1, loopable: !0 }
  },
  {
    event_key: "route_change",
    event_version: "1",
    mode: "core",
    category: "navigation",
    channel: ["browser", "mobile"],
    display_name: "라우트 변경",
    description: "라우트 이동",
    auto_collectable: !0,
    graph_hint: { role: "transition", goal_eligible: !1, loopable: !0 }
  },
  {
    event_key: "deep_link_open",
    event_version: "1",
    mode: "core",
    category: "navigation",
    channel: ["mobile"],
    display_name: "딥링크 진입",
    description: "딥링크를 통한 앱 진입",
    auto_collectable: !0,
    graph_hint: { role: "entry", goal_eligible: !1, loopable: !1 }
  },
  {
    event_key: "app_open",
    event_version: "1",
    mode: "core",
    category: "navigation",
    channel: ["mobile"],
    display_name: "앱 실행",
    description: "앱 실행",
    auto_collectable: !0,
    graph_hint: { role: "entry", goal_eligible: !1, loopable: !1 }
  },
  {
    event_key: "app_background",
    event_version: "1",
    mode: "core",
    category: "navigation",
    channel: ["mobile"],
    display_name: "앱 백그라운드",
    description: "앱 백그라운드 전환",
    auto_collectable: !0,
    graph_hint: { role: "terminal", goal_eligible: !1, loopable: !0 }
  },
  {
    event_key: "app_foreground",
    event_version: "1",
    mode: "core",
    category: "navigation",
    channel: ["mobile"],
    display_name: "앱 포그라운드",
    description: "앱 포그라운드 전환",
    auto_collectable: !0,
    graph_hint: { role: "entry", goal_eligible: !1, loopable: !0 }
  }
], sn = [
  {
    event_key: "click",
    event_version: "1",
    mode: "core",
    category: "interaction",
    channel: ["browser"],
    display_name: "클릭",
    description: "사용자의 클릭 상호작용",
    auto_collectable: !0,
    graph_hint: { role: "transition", goal_eligible: !1, loopable: !0 }
  },
  {
    event_key: "tap",
    event_version: "1",
    mode: "core",
    category: "interaction",
    channel: ["mobile"],
    display_name: "탭",
    description: "사용자의 탭 상호작용",
    auto_collectable: !0,
    graph_hint: { role: "transition", goal_eligible: !1, loopable: !0 }
  },
  {
    event_key: "scroll",
    event_version: "1",
    mode: "core",
    category: "interaction",
    channel: ["browser", "mobile"],
    display_name: "스크롤",
    description: "스크롤 동작",
    auto_collectable: !0,
    graph_hint: { role: "transition", goal_eligible: !1, loopable: !0 }
  },
  {
    event_key: "swipe",
    event_version: "1",
    mode: "core",
    category: "interaction",
    channel: ["mobile"],
    display_name: "스와이프",
    description: "스와이프 제스처",
    auto_collectable: !0,
    graph_hint: { role: "transition", goal_eligible: !1, loopable: !0 }
  },
  {
    event_key: "hover",
    event_version: "1",
    mode: "core",
    category: "interaction",
    channel: ["browser"],
    display_name: "호버",
    description: "마우스 호버",
    auto_collectable: !0,
    graph_hint: { role: "observation", goal_eligible: !1, loopable: !0 }
  },
  {
    event_key: "focus",
    event_version: "1",
    mode: "core",
    category: "interaction",
    channel: ["browser", "mobile"],
    display_name: "포커스",
    description: "입력 포커스 획득",
    auto_collectable: !0,
    graph_hint: { role: "transition", goal_eligible: !1, loopable: !0 }
  },
  {
    event_key: "blur",
    event_version: "1",
    mode: "core",
    category: "interaction",
    channel: ["browser", "mobile"],
    display_name: "포커스 해제",
    description: "입력 포커스 해제",
    auto_collectable: !0,
    graph_hint: { role: "transition", goal_eligible: !1, loopable: !0 }
  },
  {
    event_key: "select",
    event_version: "1",
    mode: "core",
    category: "interaction",
    channel: ["browser", "mobile"],
    display_name: "선택",
    description: "항목 선택",
    auto_collectable: !0,
    graph_hint: { role: "transition", goal_eligible: !1, loopable: !0 }
  },
  {
    event_key: "expand",
    event_version: "1",
    mode: "core",
    category: "interaction",
    channel: ["browser", "mobile"],
    display_name: "펼치기",
    description: "UI 요소 펼치기",
    auto_collectable: !0,
    graph_hint: { role: "transition", goal_eligible: !1, loopable: !0 }
  },
  {
    event_key: "collapse",
    event_version: "1",
    mode: "core",
    category: "interaction",
    channel: ["browser", "mobile"],
    display_name: "접기",
    description: "UI 요소 접기",
    auto_collectable: !0,
    graph_hint: { role: "transition", goal_eligible: !1, loopable: !0 }
  }
], on = [
  {
    event_key: "input_change",
    event_version: "1",
    mode: "core",
    category: "form",
    channel: ["browser", "mobile"],
    display_name: "입력값 변경",
    description: "입력 필드 값 변경",
    auto_collectable: !0,
    graph_hint: { role: "transition", goal_eligible: !1, loopable: !0 }
  },
  {
    event_key: "form_submit",
    event_version: "1",
    mode: "core",
    category: "form",
    channel: ["browser", "mobile"],
    display_name: "폼 제출",
    description: "폼 제출 시도",
    auto_collectable: !0,
    graph_hint: { role: "transition", goal_eligible: !1, loopable: !0 }
  },
  {
    event_key: "form_submit_success",
    event_version: "1",
    mode: "core",
    category: "form",
    channel: ["browser", "mobile"],
    display_name: "폼 제출 성공",
    description: "폼 제출 성공",
    auto_collectable: !1,
    graph_hint: { role: "terminal", goal_eligible: !0, loopable: !1 }
  },
  {
    event_key: "form_submit_failure",
    event_version: "1",
    mode: "core",
    category: "form",
    channel: ["browser", "mobile"],
    display_name: "폼 제출 실패",
    description: "폼 제출 실패",
    auto_collectable: !1,
    graph_hint: { role: "terminal", goal_eligible: !1, loopable: !0 }
  },
  {
    event_key: "validation_error",
    event_version: "1",
    mode: "core",
    category: "form",
    channel: ["browser", "mobile"],
    display_name: "입력 검증 실패",
    description: "입력 값 검증 실패",
    auto_collectable: !1,
    graph_hint: { role: "observation", goal_eligible: !1, loopable: !0 }
  }
], ln = [
  {
    event_key: "session_start",
    event_version: "1",
    mode: "core",
    category: "session",
    channel: ["common"],
    display_name: "세션 시작",
    description: "세션 시작",
    auto_collectable: !0,
    graph_hint: { role: "entry", goal_eligible: !1, loopable: !1 }
  },
  {
    event_key: "session_end",
    event_version: "1",
    mode: "core",
    category: "session",
    channel: ["common"],
    display_name: "세션 종료",
    description: "세션 종료",
    auto_collectable: !0,
    graph_hint: { role: "terminal", goal_eligible: !1, loopable: !1 }
  },
  {
    event_key: "session_timeout",
    event_version: "1",
    mode: "core",
    category: "session",
    channel: ["common"],
    display_name: "세션 타임아웃",
    description: "세션 비활성 타임아웃",
    auto_collectable: !0,
    graph_hint: { role: "terminal", goal_eligible: !1, loopable: !1 }
  },
  {
    event_key: "enter_flow",
    event_version: "1",
    mode: "core",
    category: "session",
    channel: ["common"],
    display_name: "시나리오 진입",
    description: "특정 시나리오/흐름 진입",
    auto_collectable: !1,
    graph_hint: { role: "entry", goal_eligible: !1, loopable: !0 }
  },
  {
    event_key: "exit_flow",
    event_version: "1",
    mode: "core",
    category: "session",
    channel: ["common"],
    display_name: "시나리오 이탈",
    description: "특정 시나리오/흐름 이탈",
    auto_collectable: !1,
    graph_hint: { role: "terminal", goal_eligible: !1, loopable: !0 }
  },
  {
    event_key: "bounce",
    event_version: "1",
    mode: "core",
    category: "session",
    channel: ["browser", "mobile"],
    display_name: "조기 이탈",
    description: "세션 초기 이탈",
    auto_collectable: !1,
    graph_hint: { role: "terminal", goal_eligible: !1, loopable: !1 }
  }
], cn = [
  {
    event_key: "http_request",
    event_version: "1",
    mode: "core",
    category: "network",
    channel: ["backend", "browser", "mobile"],
    display_name: "HTTP 요청",
    description: "HTTP 요청 발생",
    auto_collectable: !0,
    graph_hint: { role: "transition", goal_eligible: !1, loopable: !0 }
  },
  {
    event_key: "http_response",
    event_version: "1",
    mode: "core",
    category: "network",
    channel: ["backend", "browser", "mobile"],
    display_name: "HTTP 응답",
    description: "HTTP 응답 수신",
    auto_collectable: !0,
    graph_hint: { role: "transition", goal_eligible: !1, loopable: !0 }
  },
  {
    event_key: "rpc_request",
    event_version: "1",
    mode: "core",
    category: "network",
    channel: ["backend", "sdk"],
    display_name: "RPC 요청",
    description: "RPC 호출 발생",
    auto_collectable: !0,
    graph_hint: { role: "transition", goal_eligible: !1, loopable: !0 }
  },
  {
    event_key: "rpc_response",
    event_version: "1",
    mode: "core",
    category: "network",
    channel: ["backend", "sdk"],
    display_name: "RPC 응답",
    description: "RPC 응답 수신",
    auto_collectable: !0,
    graph_hint: { role: "transition", goal_eligible: !1, loopable: !0 }
  },
  {
    event_key: "websocket_open",
    event_version: "1",
    mode: "core",
    category: "network",
    channel: ["browser", "mobile"],
    display_name: "웹소켓 연결",
    description: "웹소켓 연결 수립",
    auto_collectable: !0,
    graph_hint: { role: "transition", goal_eligible: !1, loopable: !1 }
  },
  {
    event_key: "websocket_message",
    event_version: "1",
    mode: "core",
    category: "network",
    channel: ["browser", "mobile"],
    display_name: "웹소켓 메시지",
    description: "웹소켓 메시지 송수신",
    auto_collectable: !0,
    graph_hint: { role: "transition", goal_eligible: !1, loopable: !0 }
  },
  {
    event_key: "websocket_close",
    event_version: "1",
    mode: "core",
    category: "network",
    channel: ["browser", "mobile"],
    display_name: "웹소켓 종료",
    description: "웹소켓 연결 종료",
    auto_collectable: !0,
    graph_hint: { role: "terminal", goal_eligible: !1, loopable: !1 }
  },
  {
    event_key: "retry",
    event_version: "1",
    mode: "core",
    category: "network",
    channel: ["common"],
    display_name: "재시도",
    description: "네트워크 요청 재시도 발생",
    auto_collectable: !1,
    graph_hint: { role: "transition", goal_eligible: !1, loopable: !0 }
  }
], dn = [
  {
    event_key: "task_start",
    event_version: "1",
    mode: "core",
    category: "execution",
    channel: ["backend", "agent", "sdk"],
    display_name: "작업 시작",
    description: "작업/태스크 시작",
    auto_collectable: !1,
    graph_hint: { role: "entry", goal_eligible: !1, loopable: !0 }
  },
  {
    event_key: "task_finish",
    event_version: "1",
    mode: "core",
    category: "execution",
    channel: ["backend", "agent", "sdk"],
    display_name: "작업 종료",
    description: "작업/태스크 종료",
    auto_collectable: !1,
    graph_hint: { role: "terminal", goal_eligible: !1, loopable: !0 }
  },
  {
    event_key: "job_start",
    event_version: "1",
    mode: "core",
    category: "execution",
    channel: ["backend"],
    display_name: "잡 시작",
    description: "배치/잡 시작",
    auto_collectable: !1,
    graph_hint: { role: "entry", goal_eligible: !1, loopable: !1 }
  },
  {
    event_key: "job_finish",
    event_version: "1",
    mode: "core",
    category: "execution",
    channel: ["backend"],
    display_name: "잡 종료",
    description: "배치/잡 종료",
    auto_collectable: !1,
    graph_hint: { role: "terminal", goal_eligible: !1, loopable: !1 }
  },
  {
    event_key: "sdk_init",
    event_version: "1",
    mode: "core",
    category: "execution",
    channel: ["sdk", "mobile", "browser"],
    display_name: "SDK 초기화",
    description: "SDK 인스턴스 초기화",
    auto_collectable: !0,
    graph_hint: { role: "entry", goal_eligible: !1, loopable: !1 }
  },
  {
    event_key: "sdk_flush",
    event_version: "1",
    mode: "core",
    category: "execution",
    channel: ["sdk", "mobile", "browser"],
    display_name: "SDK flush",
    description: "SDK 이벤트 전송 flush",
    auto_collectable: !0,
    graph_hint: { role: "transition", goal_eligible: !1, loopable: !0 }
  },
  {
    event_key: "tool_invoke",
    event_version: "1",
    mode: "core",
    category: "execution",
    channel: ["agent"],
    display_name: "도구 호출",
    description: "에이전트 도구 호출",
    auto_collectable: !1,
    graph_hint: { role: "transition", goal_eligible: !1, loopable: !0 }
  },
  {
    event_key: "tool_result",
    event_version: "1",
    mode: "core",
    category: "execution",
    channel: ["agent"],
    display_name: "도구 결과",
    description: "에이전트 도구 결과 수신",
    auto_collectable: !1,
    graph_hint: { role: "transition", goal_eligible: !1, loopable: !0 }
  },
  {
    event_key: "state_transition",
    event_version: "1",
    mode: "core",
    category: "execution",
    channel: ["agent", "backend"],
    display_name: "상태 전이",
    description: "상태 머신/워크플로 상태 변경",
    auto_collectable: !1,
    graph_hint: { role: "transition", goal_eligible: !1, loopable: !0 }
  }
], un = [
  {
    event_key: "success",
    event_version: "1",
    mode: "core",
    category: "outcome",
    channel: ["common"],
    display_name: "성공",
    description: "작업/흐름 성공 결과",
    auto_collectable: !1,
    graph_hint: { role: "terminal", goal_eligible: !0, loopable: !1 }
  },
  {
    event_key: "failure",
    event_version: "1",
    mode: "core",
    category: "outcome",
    channel: ["common"],
    display_name: "실패",
    description: "작업/흐름 실패 결과",
    auto_collectable: !1,
    graph_hint: { role: "terminal", goal_eligible: !1, loopable: !1 }
  },
  {
    event_key: "complete",
    event_version: "1",
    mode: "core",
    category: "outcome",
    channel: ["common"],
    display_name: "완료",
    description: "작업/흐름 완료",
    auto_collectable: !1,
    graph_hint: { role: "terminal", goal_eligible: !0, loopable: !1 }
  },
  {
    event_key: "cancel",
    event_version: "1",
    mode: "core",
    category: "outcome",
    channel: ["common"],
    display_name: "취소",
    description: "사용자/시스템에 의한 취소",
    auto_collectable: !1,
    graph_hint: { role: "terminal", goal_eligible: !1, loopable: !1 }
  },
  {
    event_key: "timeout",
    event_version: "1",
    mode: "core",
    category: "outcome",
    channel: ["common"],
    display_name: "시간 초과",
    description: "제한 시간 초과",
    auto_collectable: !1,
    graph_hint: { role: "terminal", goal_eligible: !1, loopable: !1 }
  },
  {
    event_key: "drop_off",
    event_version: "1",
    mode: "core",
    category: "outcome",
    channel: ["common"],
    display_name: "흐름 이탈",
    description: "흐름 중도 이탈",
    auto_collectable: !1,
    graph_hint: { role: "terminal", goal_eligible: !1, loopable: !1 }
  },
  {
    event_key: "conversion",
    event_version: "1",
    mode: "core",
    category: "outcome",
    channel: ["browser", "mobile"],
    display_name: "전환",
    description: "목표 전환 달성",
    auto_collectable: !1,
    graph_hint: { role: "terminal", goal_eligible: !0, loopable: !1 }
  }
], hn = [
  {
    event_key: "error",
    event_version: "1",
    mode: "core",
    category: "quality",
    channel: ["common"],
    display_name: "오류",
    description: "오류 발생",
    auto_collectable: !0,
    graph_hint: { role: "observation", goal_eligible: !1, loopable: !0 }
  },
  {
    event_key: "warning",
    event_version: "1",
    mode: "core",
    category: "quality",
    channel: ["common"],
    display_name: "경고",
    description: "경고 조건 감지",
    auto_collectable: !1,
    graph_hint: { role: "observation", goal_eligible: !1, loopable: !0 }
  },
  {
    event_key: "assertion",
    event_version: "1",
    mode: "core",
    category: "quality",
    channel: ["qa", "agent", "backend"],
    display_name: "검증",
    description: "QA/엔진 검증 결과",
    auto_collectable: !1,
    graph_hint: { role: "observation", goal_eligible: !1, loopable: !0 }
  },
  {
    event_key: "mask_applied",
    event_version: "1",
    mode: "core",
    category: "quality",
    channel: ["sdk", "common"],
    display_name: "마스킹 적용",
    description: "민감정보 마스킹 처리",
    auto_collectable: !1,
    graph_hint: { role: "observation", goal_eligible: !1, loopable: !0 }
  },
  {
    event_key: "field_present",
    event_version: "1",
    mode: "core",
    category: "quality",
    channel: ["sdk", "common"],
    display_name: "필드 존재",
    description: "특정 필드 존재 확인",
    auto_collectable: !1,
    graph_hint: { role: "observation", goal_eligible: !1, loopable: !0 }
  },
  {
    event_key: "field_missing",
    event_version: "1",
    mode: "core",
    category: "quality",
    channel: ["sdk", "common"],
    display_name: "필드 누락",
    description: "기대 필드 누락",
    auto_collectable: !1,
    graph_hint: { role: "observation", goal_eligible: !1, loopable: !0 }
  },
  {
    event_key: "policy_violation",
    event_version: "1",
    mode: "core",
    category: "quality",
    channel: ["sdk", "common"],
    display_name: "정책 위반",
    description: "데이터/보안 정책 위반",
    auto_collectable: !1,
    graph_hint: { role: "observation", goal_eligible: !1, loopable: !0 }
  },
  {
    event_key: "unexpected_event",
    event_version: "1",
    mode: "core",
    category: "quality",
    channel: ["qa", "common"],
    display_name: "예상 외 이벤트",
    description: "시나리오에 정의되지 않은 이벤트 감지",
    auto_collectable: !1,
    graph_hint: { role: "observation", goal_eligible: !1, loopable: !1 }
  }
], Ve = [
  ...an,
  ...sn,
  ...on,
  ...ln,
  ...cn,
  ...dn,
  ...un,
  ...hn
], De = new Map(Ve.map((n) => [n.event_key, n]));
function fn(n) {
  return De.get(n);
}
Ve.filter((n) => n.auto_collectable);
const pn = [
  // ── Navigation ───────────────────────────────────────
  {
    event_key: "page_view",
    fields: [
      { name: "page", required: !0, type: "string", description: "페이지 경로" },
      { name: "title", required: !1, type: "string", description: "페이지 제목" },
      { name: "referrer", required: !1, type: "string", description: "이전 페이지" },
      { name: "query", required: !1, type: "string", description: "주요 쿼리 파라미터" },
      { name: "flow_id", required: !1, type: "string", description: "연결된 시나리오 흐름" }
    ]
  },
  {
    event_key: "screen_view",
    fields: [
      { name: "screen", required: !0, type: "string", description: "화면 식별자" },
      { name: "screen_class", required: !1, type: "string", description: "화면 클래스" },
      { name: "referrer_screen", required: !1, type: "string", description: "이전 화면" },
      { name: "flow_id", required: !1, type: "string", description: "연결 흐름" }
    ]
  },
  {
    event_key: "route_change",
    fields: [
      { name: "from", required: !0, type: "string", description: "이전 경로/화면" },
      { name: "to", required: !0, type: "string", description: "이동 경로/화면" },
      { name: "reason", required: !1, type: "string", description: "이동 원인" }
    ]
  },
  {
    event_key: "app_open",
    fields: [
      { name: "launch_type", required: !1, type: "string", description: "cold/warm 등" },
      { name: "entry_point", required: !1, type: "string", description: "실행 진입점" },
      { name: "deep_link", required: !1, type: "string", description: "딥링크 값" }
    ]
  },
  // ── Interaction ──────────────────────────────────────
  {
    event_key: "click",
    fields: [
      { name: "element_id", required: !0, type: "string", description: "요소 식별자" },
      { name: "page", required: !1, type: "string", description: "현재 페이지" },
      { name: "element_text", required: !1, type: "string", description: "버튼/링크 텍스트" },
      { name: "element_type", required: !1, type: "string", description: "button/link/card" },
      { name: "flow_id", required: !1, type: "string", description: "연결 흐름" }
    ]
  },
  {
    event_key: "tap",
    fields: [
      { name: "element_id", required: !0, type: "string", description: "요소 식별자" },
      { name: "screen", required: !1, type: "string", description: "현재 화면" },
      { name: "element_text", required: !1, type: "string", description: "표시 텍스트" },
      { name: "gesture_type", required: !1, type: "string", description: "single/double" }
    ]
  },
  // ── Form ─────────────────────────────────────────────
  {
    event_key: "input_change",
    fields: [
      { name: "field_name", required: !0, type: "string", description: "입력 필드명" },
      { name: "field_present", required: !1, type: "boolean", description: "값 존재 여부" },
      { name: "masked", required: !1, type: "boolean", description: "값 마스킹 여부" },
      { name: "input_length", required: !1, type: "number", description: "입력 길이" },
      { name: "valid", required: !1, type: "boolean", description: "검증 상태" }
    ]
  },
  {
    event_key: "form_submit",
    fields: [
      { name: "form_id", required: !0, type: "string", description: "폼 식별자" },
      { name: "field_count", required: !1, type: "number", description: "필드 수" },
      { name: "valid", required: !1, type: "boolean", description: "제출 시점 유효성" },
      { name: "flow_id", required: !1, type: "string", description: "연결 흐름" }
    ]
  },
  // ── Session ──────────────────────────────────────────
  {
    event_key: "session_start",
    fields: [
      { name: "session_type", required: !1, type: "string", description: "user/test/agent" },
      { name: "entry_point", required: !1, type: "string", description: "진입 지점" },
      { name: "flow_id", required: !1, type: "string", description: "연결 흐름" }
    ]
  },
  {
    event_key: "session_end",
    fields: [
      { name: "duration_ms", required: !1, type: "number", description: "세션 길이" },
      { name: "end_reason", required: !1, type: "string", description: "종료 원인" },
      { name: "flow_id", required: !1, type: "string", description: "연결 흐름" }
    ]
  },
  // ── Network ──────────────────────────────────────────
  {
    event_key: "http_request",
    fields: [
      { name: "method", required: !0, type: "string", description: "GET/POST 등" },
      { name: "route", required: !0, type: "string", description: "API 경로" },
      { name: "request_present_fields", required: !1, type: "string[]", description: "전달된 주요 필드" },
      { name: "masked_fields", required: !1, type: "string[]", description: "마스킹 필드 목록" },
      { name: "request_size", required: !1, type: "number", description: "요청 크기" },
      { name: "target_service", required: !1, type: "string", description: "대상 서비스" }
    ]
  },
  {
    event_key: "http_response",
    fields: [
      { name: "method", required: !0, type: "string", description: "요청 메서드" },
      { name: "route", required: !0, type: "string", description: "API 경로" },
      { name: "status_code", required: !0, type: "number", description: "응답 코드" },
      { name: "duration_ms", required: !1, type: "number", description: "응답 시간" },
      { name: "error_code", required: !1, type: "string", description: "내부 에러 코드" }
    ]
  },
  // ── Execution ────────────────────────────────────────
  {
    event_key: "sdk_init",
    fields: [
      { name: "sdk_instance_id", required: !1, type: "string", description: "SDK 인스턴스" },
      { name: "init_mode", required: !1, type: "string", description: "auto/manual" },
      { name: "config_version", required: !1, type: "string", description: "설정 버전" },
      { name: "result", required: !1, type: "string", description: "성공/실패" }
    ]
  },
  {
    event_key: "sdk_flush",
    fields: [
      { name: "flush_reason", required: !1, type: "string", description: "timer/manual/background" },
      { name: "record_count", required: !1, type: "number", description: "전송 이벤트 수" },
      { name: "success_count", required: !1, type: "number", description: "성공 수" },
      { name: "failure_count", required: !1, type: "number", description: "실패 수" },
      { name: "duration_ms", required: !1, type: "number", description: "flush 시간" }
    ]
  },
  {
    event_key: "task_start",
    fields: [
      { name: "task_name", required: !0, type: "string", description: "작업 이름" },
      { name: "task_type", required: !1, type: "string", description: "qa/agent/job" },
      { name: "input_present", required: !1, type: "boolean", description: "입력 존재 여부" }
    ]
  },
  {
    event_key: "task_finish",
    fields: [
      { name: "task_name", required: !0, type: "string", description: "작업 이름" },
      { name: "result", required: !1, type: "string", description: "success/failure" },
      { name: "duration_ms", required: !1, type: "number", description: "소요 시간" },
      { name: "reason", required: !1, type: "string", description: "실패/종료 이유" }
    ]
  },
  // ── Outcome ──────────────────────────────────────────
  {
    event_key: "success",
    fields: [
      { name: "target", required: !1, type: "string", description: "성공 대상" },
      { name: "reason", required: !1, type: "string", description: "성공 이유" },
      { name: "flow_id", required: !1, type: "string", description: "흐름 식별" }
    ]
  },
  {
    event_key: "failure",
    fields: [
      { name: "target", required: !1, type: "string", description: "실패 대상" },
      { name: "reason", required: !0, type: "string", description: "실패 이유" },
      { name: "error_code", required: !1, type: "string", description: "에러 코드" },
      { name: "flow_id", required: !1, type: "string", description: "흐름 식별" }
    ]
  },
  // ── Quality ──────────────────────────────────────────
  {
    event_key: "error",
    fields: [
      { name: "error_type", required: !0, type: "string", description: "오류 유형" },
      { name: "error_code", required: !1, type: "string", description: "에러 코드" },
      { name: "message", required: !1, type: "string", description: "에러 메시지" },
      { name: "recoverable", required: !1, type: "boolean", description: "복구 가능 여부" }
    ]
  },
  {
    event_key: "assertion",
    fields: [
      { name: "assertion_key", required: !0, type: "string", description: "검증 식별자" },
      { name: "expected", required: !1, type: "string", description: "기대값" },
      { name: "actual", required: !1, type: "string", description: "실제값" },
      { name: "passed", required: !0, type: "boolean", description: "성공 여부" },
      { name: "reason", required: !1, type: "string", description: "실패 사유" }
    ]
  }
];
new Map(pn.map((n) => [n.event_key, n]));
const mn = [
  "page_view",
  "screen_view",
  "route_change",
  "app_open",
  "click",
  "tap",
  "input_change",
  "form_submit",
  "session_start",
  "session_end",
  "http_request",
  "http_response",
  "sdk_init",
  "sdk_flush",
  "task_start",
  "task_finish",
  "success",
  "failure",
  "error",
  "assertion"
];
mn.map((n) => {
  const e = De.get(n);
  if (!e)
    throw new Error(`v1 minimal event not found in registry: ${n}`);
  return e;
});
class _n {
  constructor(e) {
    k(this, "endpoint");
    this.endpoint = e;
  }
  async send(e) {
    const t = JSON.stringify(e);
    if (typeof navigator < "u" && navigator.sendBeacon) {
      const a = new Blob([t], { type: "application/json" });
      if (navigator.sendBeacon(this.endpoint, a)) return;
    }
    const r = await fetch(this.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: t,
      keepalive: !0
    });
    if (!r.ok)
      throw new Error(`[BeaconTransport] ${r.status} ${r.statusText}`);
  }
  async flush() {
  }
  async shutdown() {
  }
}
const Be = "qa_monitor";
function Ze(n = Be) {
  try {
    const t = sessionStorage.getItem(n);
    if (t) {
      const r = JSON.parse(t);
      if (r.sessionId && r.traceId)
        return { sessionId: r.sessionId, traceId: r.traceId };
    }
  } catch {
  }
  const e = {
    sessionId: Qt(),
    traceId: ze()
  };
  try {
    sessionStorage.setItem(n, JSON.stringify(e));
  } catch {
  }
  return e;
}
function gn(n = Be) {
  try {
    sessionStorage.removeItem(n);
  } catch {
  }
}
function yn(n, e) {
  const t = [];
  if (n.clicks) {
    const r = (a) => {
      var o;
      const s = a.target;
      if (!s) return;
      const i = s.closest("button, a, [data-qa-event]");
      i && e("click", {
        tag: i.tagName.toLowerCase(),
        text: ((o = i.textContent) == null ? void 0 : o.trim().slice(0, 100)) ?? "",
        qa_id: i.dataset.qaId ?? i.id ?? void 0,
        href: i instanceof HTMLAnchorElement ? i.href : void 0,
        qa_event: i.dataset.qaEvent ?? void 0
      });
    };
    document.addEventListener("click", r, !0), t.push(() => document.removeEventListener("click", r, !0));
  }
  if (n.forms) {
    const r = (a) => {
      const s = a.target;
      if (!s) return;
      const i = new FormData(s), o = [];
      i.forEach((u, h) => o.push(h)), e("form_submit", {
        form_id: s.id || void 0,
        form_action: s.action || void 0,
        field_count: o.length
      });
    };
    document.addEventListener("submit", r, !0), t.push(() => document.removeEventListener("submit", r, !0));
  }
  if (n.navigation) {
    const r = () => {
      e("page_view", { url: location.href, referrer: document.referrer });
    };
    window.addEventListener("popstate", r), t.push(() => window.removeEventListener("popstate", r));
    const a = history.pushState;
    history.pushState = function(...s) {
      a.call(history, ...s), e("page_view", { url: location.href });
    }, t.push(() => {
      history.pushState = a;
    });
  }
  return () => t.forEach((r) => r());
}
class vn {
  constructor(e) {
    k(this, "logger");
    k(this, "session");
    k(this, "storageKey");
    k(this, "destroyAutoCapture", null);
    k(this, "unloadHandler");
    k(this, "_status", "active");
    var o, u;
    this.storageKey = e.storageKey ?? "qa_monitor", this.session = Ze(this.storageKey);
    const t = new _n(`${e.ingestUrl}/v1/ingest`), r = e.serviceConfig, a = r ? He(r, "@qa-sdk/browser", "0.1.0") : { service_name: ((o = e.meta) == null ? void 0 : o.serviceName) ?? "browser", sdk_name: "@qa-sdk/browser", sdk_version: "0.1.0" }, s = r ? Je(r) : { env: ((u = e.meta) == null ? void 0 : u.env) ?? "production" };
    this.logger = new rn({
      transport: t,
      owner: e.owner ?? { owner_type: "tenant", owner_id: "browser-monitor" },
      source: a,
      runtime: {
        platform: "browser",
        os_version: typeof navigator < "u" ? navigator.userAgent : "unknown"
      },
      build: s,
      flushIntervalMs: 5e3,
      onError: e.onError,
      ...e.infraContext ? { infraContext: e.infraContext } : {},
      ...e.entrySnapshot ? { entrySnapshot: e.entrySnapshot } : {}
    });
    const i = new se({
      trace_id: this.session.traceId,
      qa_session_id: this.session.sessionId
    });
    this.logger.setContext(i), e.scenarioId && this.emit("session_start", { scenario_id: e.scenarioId }), e.autoCapture && (this.destroyAutoCapture = yn(e.autoCapture, (h, y) => {
      this.emit(h, y);
    })), this.unloadHandler = () => {
      this.logger.flush().catch(() => {
      });
    }, typeof window < "u" && window.addEventListener("pagehide", this.unloadHandler);
  }
  // ── 상태 조회 ───────────────────────────────────────────
  /** 현재 생명주기 상태 */
  get status() {
    return this._status;
  }
  /** 이벤트 수집 가능 여부 */
  get isActive() {
    return this._status === "active";
  }
  // ── 이벤트 발생 ─────────────────────────────────────────
  /**
   * 수동 이벤트 발생.
   * event-catalog에 등록된 event_key면 버전을 자동으로 조회한다.
   * stopped 상태에서는 경고 후 무시된다.
   */
  emit(e, t, r) {
    if (this._status === "stopped") {
      console.warn(`[QaMonitor] emit("${e}") called after shutdown — event dropped`);
      return;
    }
    const a = fn(e), s = ((a == null ? void 0 : a.event_version) ?? "1").padStart(3, "0");
    this.logger.log({
      event_key: e,
      event_version: s,
      payload: t,
      ...r != null && r.address_context ? { address_context: r.address_context } : {}
    });
  }
  // ── 메트릭 ─────────────────────────────────────────────
  /**
   * 메트릭 이벤트 기록. QaLogger.metric() 위임.
   * stopped 상태에서는 경고 후 무시.
   */
  metric(e, t, r) {
    if (this._status === "stopped") {
      console.warn(`[QaMonitor] metric("${e}") called after shutdown — event dropped`);
      return;
    }
    this.logger.metric(e, t, r);
  }
  // ── 세션 관리 ───────────────────────────────────────────
  /** 현재 세션 정보 반환 (복사본) */
  getSession() {
    return { ...this.session };
  }
  /**
   * 세션을 초기화하고 새로운 sessionId / traceId를 발급한다.
   * stopped 상태에서는 경고 후 현재 세션을 반환한다.
   */
  newSession() {
    if (this._status === "stopped")
      return console.warn("[QaMonitor] newSession() called after shutdown — ignored"), { ...this.session };
    gn(this.storageKey);
    const e = Ze(this.storageKey), t = new se({
      trace_id: e.traceId,
      qa_session_id: e.sessionId
    });
    return this.logger.setContext(t), this.session = e, e;
  }
  // ── 전송 제어 ───────────────────────────────────────────
  /**
   * 버퍼에 쌓인 이벤트를 즉시 전송.
   * stopped 상태에서는 no-op (이미 shutdown에서 flush 완료).
   * 전송 실패 시 throw.
   */
  async flush() {
    this._status !== "stopped" && await this.logger.flush();
  }
  /**
   * ACTIVE → STOPPED 전환.
   * autoCapture 리스너 제거, pagehide 리스너 제거,
   * 남은 버퍼를 전송한 뒤 QaLogger 타이머 정리.
   * 멱등 — 이미 stopped이면 즉시 반환.
   */
  async shutdown() {
    var e;
    this._status !== "stopped" && (this._status = "stopped", (e = this.destroyAutoCapture) == null || e.call(this), this.destroyAutoCapture = null, typeof window < "u" && window.removeEventListener("pagehide", this.unloadHandler), await this.logger.shutdown());
  }
}
function wn(n) {
  return new vn(n);
}
export {
  _n as BeaconTransport,
  vn as QaMonitor,
  xn as buildEnvToCatalogEnv,
  Ge as catalogEnvToBuildEnv,
  wn as createQaMonitor,
  oe as newLogId,
  Qt as newQaSessionId,
  Kt as newSpanId,
  ze as newTraceId,
  Jt as newTransmissionId,
  kn as toServiceDims,
  Je as toTransmissionBuild,
  He as toTransmissionSource
};
//# sourceMappingURL=qa-browser-sdk.js.map
