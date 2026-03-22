var Ke = Object.defineProperty;
var Ge = (n, e, t) => e in n ? Ke(n, e, { enumerable: !0, configurable: !0, writable: !0, value: t }) : n[e] = t;
var b = (n, e, t) => Ge(n, typeof e != "symbol" ? e + "" : e, t);
function Cn(n) {
  return {
    env: n.env,
    region: n.region,
    svc_name: n.name,
    namespace: n.namespace
  };
}
function Je(n, e, t) {
  return {
    service_name: `${n.namespace}/${n.name}`,
    sdk_name: e,
    sdk_version: t
  };
}
function Qe(n) {
  return {
    env: et(n.env),
    ...n.build != null ? { build_ref: n.build } : {},
    ...n.releaseVersion != null ? { release_version: n.releaseVersion } : {}
  };
}
const Ye = {
  prod: "production",
  stage: "staging"
}, Xe = {
  production: "prod",
  staging: "stage"
};
function et(n) {
  return Ye[n] ?? n;
}
function qn(n) {
  return Xe[n] ?? n;
}
var k;
(function(n) {
  n.assertEqual = (s) => {
  };
  function e(s) {
  }
  n.assertIs = e;
  function t(s) {
    throw new Error();
  }
  n.assertNever = t, n.arrayToEnum = (s) => {
    const i = {};
    for (const a of s)
      i[a] = a;
    return i;
  }, n.getValidEnumValues = (s) => {
    const i = n.objectKeys(s).filter((o) => typeof s[s[o]] != "number"), a = {};
    for (const o of i)
      a[o] = s[o];
    return n.objectValues(a);
  }, n.objectValues = (s) => n.objectKeys(s).map(function(i) {
    return s[i];
  }), n.objectKeys = typeof Object.keys == "function" ? (s) => Object.keys(s) : (s) => {
    const i = [];
    for (const a in s)
      Object.prototype.hasOwnProperty.call(s, a) && i.push(a);
    return i;
  }, n.find = (s, i) => {
    for (const a of s)
      if (i(a))
        return a;
  }, n.isInteger = typeof Number.isInteger == "function" ? (s) => Number.isInteger(s) : (s) => typeof s == "number" && Number.isFinite(s) && Math.floor(s) === s;
  function r(s, i = " | ") {
    return s.map((a) => typeof a == "string" ? `'${a}'` : a).join(i);
  }
  n.joinValues = r, n.jsonStringifyReplacer = (s, i) => typeof i == "bigint" ? i.toString() : i;
})(k || (k = {}));
var xe;
(function(n) {
  n.mergeShapes = (e, t) => ({
    ...e,
    ...t
    // second overwrites first
  });
})(xe || (xe = {}));
const p = k.arrayToEnum([
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
]), Z = (n) => {
  switch (typeof n) {
    case "undefined":
      return p.undefined;
    case "string":
      return p.string;
    case "number":
      return Number.isNaN(n) ? p.nan : p.number;
    case "boolean":
      return p.boolean;
    case "function":
      return p.function;
    case "bigint":
      return p.bigint;
    case "symbol":
      return p.symbol;
    case "object":
      return Array.isArray(n) ? p.array : n === null ? p.null : n.then && typeof n.then == "function" && n.catch && typeof n.catch == "function" ? p.promise : typeof Map < "u" && n instanceof Map ? p.map : typeof Set < "u" && n instanceof Set ? p.set : typeof Date < "u" && n instanceof Date ? p.date : p.object;
    default:
      return p.unknown;
  }
}, l = k.arrayToEnum([
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
class j extends Error {
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
    const t = e || function(i) {
      return i.message;
    }, r = { _errors: [] }, s = (i) => {
      for (const a of i.issues)
        if (a.code === "invalid_union")
          a.unionErrors.map(s);
        else if (a.code === "invalid_return_type")
          s(a.returnTypeError);
        else if (a.code === "invalid_arguments")
          s(a.argumentsError);
        else if (a.path.length === 0)
          r._errors.push(t(a));
        else {
          let o = r, c = 0;
          for (; c < a.path.length; ) {
            const d = a.path[c];
            c === a.path.length - 1 ? (o[d] = o[d] || { _errors: [] }, o[d]._errors.push(t(a))) : o[d] = o[d] || { _errors: [] }, o = o[d], c++;
          }
        }
    };
    return s(this), r;
  }
  static assert(e) {
    if (!(e instanceof j))
      throw new Error(`Not a ZodError: ${e}`);
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, k.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(e = (t) => t.message) {
    const t = {}, r = [];
    for (const s of this.issues)
      if (s.path.length > 0) {
        const i = s.path[0];
        t[i] = t[i] || [], t[i].push(e(s));
      } else
        r.push(e(s));
    return { formErrors: r, fieldErrors: t };
  }
  get formErrors() {
    return this.flatten();
  }
}
j.create = (n) => new j(n);
const ue = (n, e) => {
  let t;
  switch (n.code) {
    case l.invalid_type:
      n.received === p.undefined ? t = "Required" : t = `Expected ${n.expected}, received ${n.received}`;
      break;
    case l.invalid_literal:
      t = `Invalid literal value, expected ${JSON.stringify(n.expected, k.jsonStringifyReplacer)}`;
      break;
    case l.unrecognized_keys:
      t = `Unrecognized key(s) in object: ${k.joinValues(n.keys, ", ")}`;
      break;
    case l.invalid_union:
      t = "Invalid input";
      break;
    case l.invalid_union_discriminator:
      t = `Invalid discriminator value. Expected ${k.joinValues(n.options)}`;
      break;
    case l.invalid_enum_value:
      t = `Invalid enum value. Expected ${k.joinValues(n.options)}, received '${n.received}'`;
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
      typeof n.validation == "object" ? "includes" in n.validation ? (t = `Invalid input: must include "${n.validation.includes}"`, typeof n.validation.position == "number" && (t = `${t} at one or more positions greater than or equal to ${n.validation.position}`)) : "startsWith" in n.validation ? t = `Invalid input: must start with "${n.validation.startsWith}"` : "endsWith" in n.validation ? t = `Invalid input: must end with "${n.validation.endsWith}"` : k.assertNever(n.validation) : n.validation !== "regex" ? t = `Invalid ${n.validation}` : t = "Invalid";
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
      t = e.defaultError, k.assertNever(n);
  }
  return { message: t };
};
let tt = ue;
function nt() {
  return tt;
}
const rt = (n) => {
  const { data: e, path: t, errorMaps: r, issueData: s } = n, i = [...t, ...s.path || []], a = {
    ...s,
    path: i
  };
  if (s.message !== void 0)
    return {
      ...s,
      path: i,
      message: s.message
    };
  let o = "";
  const c = r.filter((d) => !!d).slice().reverse();
  for (const d of c)
    o = d(a, { data: e, defaultError: o }).message;
  return {
    ...s,
    path: i,
    message: o
  };
};
function u(n, e) {
  const t = nt(), r = rt({
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
      t === ue ? void 0 : ue
      // then global default map
    ].filter((s) => !!s)
  });
  n.common.issues.push(r);
}
class S {
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
    for (const s of t) {
      if (s.status === "aborted")
        return g;
      s.status === "dirty" && e.dirty(), r.push(s.value);
    }
    return { status: e.value, value: r };
  }
  static async mergeObjectAsync(e, t) {
    const r = [];
    for (const s of t) {
      const i = await s.key, a = await s.value;
      r.push({
        key: i,
        value: a
      });
    }
    return S.mergeObjectSync(e, r);
  }
  static mergeObjectSync(e, t) {
    const r = {};
    for (const s of t) {
      const { key: i, value: a } = s;
      if (i.status === "aborted" || a.status === "aborted")
        return g;
      i.status === "dirty" && e.dirty(), a.status === "dirty" && e.dirty(), i.value !== "__proto__" && (typeof a.value < "u" || s.alwaysSet) && (r[i.value] = a.value);
    }
    return { status: e.value, value: r };
  }
}
const g = Object.freeze({
  status: "aborted"
}), H = (n) => ({ status: "dirty", value: n }), C = (n) => ({ status: "valid", value: n }), we = (n) => n.status === "aborted", Se = (n) => n.status === "dirty", V = (n) => n.status === "valid", te = (n) => typeof Promise < "u" && n instanceof Promise;
var f;
(function(n) {
  n.errToObj = (e) => typeof e == "string" ? { message: e } : e || {}, n.toString = (e) => typeof e == "string" ? e : e == null ? void 0 : e.message;
})(f || (f = {}));
class O {
  constructor(e, t, r, s) {
    this._cachedPath = [], this.parent = e, this.data = t, this._path = r, this._key = s;
  }
  get path() {
    return this._cachedPath.length || (Array.isArray(this._key) ? this._cachedPath.push(...this._path, ...this._key) : this._cachedPath.push(...this._path, this._key)), this._cachedPath;
  }
}
const Te = (n, e) => {
  if (V(e))
    return { success: !0, data: e.value };
  if (!n.common.issues.length)
    throw new Error("Validation failed but no issues detected.");
  return {
    success: !1,
    get error() {
      if (this._error)
        return this._error;
      const t = new j(n.common.issues);
      return this._error = t, this._error;
    }
  };
};
function y(n) {
  if (!n)
    return {};
  const { errorMap: e, invalid_type_error: t, required_error: r, description: s } = n;
  if (e && (t || r))
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  return e ? { errorMap: e, description: s } : { errorMap: (a, o) => {
    const { message: c } = n;
    return a.code === "invalid_enum_value" ? { message: c ?? o.defaultError } : typeof o.data > "u" ? { message: c ?? r ?? o.defaultError } : a.code !== "invalid_type" ? { message: o.defaultError } : { message: c ?? t ?? o.defaultError };
  }, description: s };
}
class v {
  get description() {
    return this._def.description;
  }
  _getType(e) {
    return Z(e.data);
  }
  _getOrReturnCtx(e, t) {
    return t || {
      common: e.parent.common,
      data: e.data,
      parsedType: Z(e.data),
      schemaErrorMap: this._def.errorMap,
      path: e.path,
      parent: e.parent
    };
  }
  _processInputParams(e) {
    return {
      status: new S(),
      ctx: {
        common: e.parent.common,
        data: e.data,
        parsedType: Z(e.data),
        schemaErrorMap: this._def.errorMap,
        path: e.path,
        parent: e.parent
      }
    };
  }
  _parseSync(e) {
    const t = this._parse(e);
    if (te(t))
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
      parsedType: Z(e)
    }, s = this._parseSync({ data: e, path: r.path, parent: r });
    return Te(r, s);
  }
  "~validate"(e) {
    var r, s;
    const t = {
      common: {
        issues: [],
        async: !!this["~standard"].async
      },
      path: [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data: e,
      parsedType: Z(e)
    };
    if (!this["~standard"].async)
      try {
        const i = this._parseSync({ data: e, path: [], parent: t });
        return V(i) ? {
          value: i.value
        } : {
          issues: t.common.issues
        };
      } catch (i) {
        (s = (r = i == null ? void 0 : i.message) == null ? void 0 : r.toLowerCase()) != null && s.includes("encountered") && (this["~standard"].async = !0), t.common = {
          issues: [],
          async: !0
        };
      }
    return this._parseAsync({ data: e, path: [], parent: t }).then((i) => V(i) ? {
      value: i.value
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
      parsedType: Z(e)
    }, s = this._parse({ data: e, path: r.path, parent: r }), i = await (te(s) ? s : Promise.resolve(s));
    return Te(r, i);
  }
  refine(e, t) {
    const r = (s) => typeof t == "string" || typeof t > "u" ? { message: t } : typeof t == "function" ? t(s) : t;
    return this._refinement((s, i) => {
      const a = e(s), o = () => i.addIssue({
        code: l.custom,
        ...r(s)
      });
      return typeof Promise < "u" && a instanceof Promise ? a.then((c) => c ? !0 : (o(), !1)) : a ? !0 : (o(), !1);
    });
  }
  refinement(e, t) {
    return this._refinement((r, s) => e(r) ? !0 : (s.addIssue(typeof t == "function" ? t(r, s) : t), !1));
  }
  _refinement(e) {
    return new z({
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
    return $.create(this, this._def);
  }
  nullable() {
    return U.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return I.create(this);
  }
  promise() {
    return ae.create(this, this._def);
  }
  or(e) {
    return re.create([this, e], this._def);
  }
  and(e) {
    return se.create(this, e, this._def);
  }
  transform(e) {
    return new z({
      ...y(this._def),
      schema: this,
      typeName: m.ZodEffects,
      effect: { type: "transform", transform: e }
    });
  }
  default(e) {
    const t = typeof e == "function" ? e : () => e;
    return new _e({
      ...y(this._def),
      innerType: this,
      defaultValue: t,
      typeName: m.ZodDefault
    });
  }
  brand() {
    return new Ct({
      typeName: m.ZodBranded,
      type: this,
      ...y(this._def)
    });
  }
  catch(e) {
    const t = typeof e == "function" ? e : () => e;
    return new me({
      ...y(this._def),
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
    return ye.create(this, e);
  }
  readonly() {
    return ge.create(this);
  }
  isOptional() {
    return this.safeParse(void 0).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
}
const st = /^c[^\s-]{8,}$/i, it = /^[0-9a-z]+$/, at = /^[0-9A-HJKMNP-TV-Z]{26}$/i, ot = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i, lt = /^[a-z0-9_-]{21}$/i, ct = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/, dt = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/, ut = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i, pt = "^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$";
let ce;
const ft = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/, ht = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/, _t = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/, mt = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/, gt = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/, yt = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/, Le = "((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))", vt = new RegExp(`^${Le}$`);
function ze(n) {
  let e = "[0-5]\\d";
  n.precision ? e = `${e}\\.\\d{${n.precision}}` : n.precision == null && (e = `${e}(\\.\\d+)?`);
  const t = n.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${e})${t}`;
}
function kt(n) {
  return new RegExp(`^${ze(n)}$`);
}
function bt(n) {
  let e = `${Le}T${ze(n)}`;
  const t = [];
  return t.push(n.local ? "Z?" : "Z"), n.offset && t.push("([+-]\\d{2}:?\\d{2})"), e = `${e}(${t.join("|")})`, new RegExp(`^${e}$`);
}
function xt(n, e) {
  return !!((e === "v4" || !e) && ft.test(n) || (e === "v6" || !e) && _t.test(n));
}
function wt(n, e) {
  if (!ct.test(n))
    return !1;
  try {
    const [t] = n.split(".");
    if (!t)
      return !1;
    const r = t.replace(/-/g, "+").replace(/_/g, "/").padEnd(t.length + (4 - t.length % 4) % 4, "="), s = JSON.parse(atob(r));
    return !(typeof s != "object" || s === null || "typ" in s && (s == null ? void 0 : s.typ) !== "JWT" || !s.alg || e && s.alg !== e);
  } catch {
    return !1;
  }
}
function St(n, e) {
  return !!((e === "v4" || !e) && ht.test(n) || (e === "v6" || !e) && mt.test(n));
}
class R extends v {
  _parse(e) {
    if (this._def.coerce && (e.data = String(e.data)), this._getType(e) !== p.string) {
      const i = this._getOrReturnCtx(e);
      return u(i, {
        code: l.invalid_type,
        expected: p.string,
        received: i.parsedType
      }), g;
    }
    const r = new S();
    let s;
    for (const i of this._def.checks)
      if (i.kind === "min")
        e.data.length < i.value && (s = this._getOrReturnCtx(e, s), u(s, {
          code: l.too_small,
          minimum: i.value,
          type: "string",
          inclusive: !0,
          exact: !1,
          message: i.message
        }), r.dirty());
      else if (i.kind === "max")
        e.data.length > i.value && (s = this._getOrReturnCtx(e, s), u(s, {
          code: l.too_big,
          maximum: i.value,
          type: "string",
          inclusive: !0,
          exact: !1,
          message: i.message
        }), r.dirty());
      else if (i.kind === "length") {
        const a = e.data.length > i.value, o = e.data.length < i.value;
        (a || o) && (s = this._getOrReturnCtx(e, s), a ? u(s, {
          code: l.too_big,
          maximum: i.value,
          type: "string",
          inclusive: !0,
          exact: !0,
          message: i.message
        }) : o && u(s, {
          code: l.too_small,
          minimum: i.value,
          type: "string",
          inclusive: !0,
          exact: !0,
          message: i.message
        }), r.dirty());
      } else if (i.kind === "email")
        ut.test(e.data) || (s = this._getOrReturnCtx(e, s), u(s, {
          validation: "email",
          code: l.invalid_string,
          message: i.message
        }), r.dirty());
      else if (i.kind === "emoji")
        ce || (ce = new RegExp(pt, "u")), ce.test(e.data) || (s = this._getOrReturnCtx(e, s), u(s, {
          validation: "emoji",
          code: l.invalid_string,
          message: i.message
        }), r.dirty());
      else if (i.kind === "uuid")
        ot.test(e.data) || (s = this._getOrReturnCtx(e, s), u(s, {
          validation: "uuid",
          code: l.invalid_string,
          message: i.message
        }), r.dirty());
      else if (i.kind === "nanoid")
        lt.test(e.data) || (s = this._getOrReturnCtx(e, s), u(s, {
          validation: "nanoid",
          code: l.invalid_string,
          message: i.message
        }), r.dirty());
      else if (i.kind === "cuid")
        st.test(e.data) || (s = this._getOrReturnCtx(e, s), u(s, {
          validation: "cuid",
          code: l.invalid_string,
          message: i.message
        }), r.dirty());
      else if (i.kind === "cuid2")
        it.test(e.data) || (s = this._getOrReturnCtx(e, s), u(s, {
          validation: "cuid2",
          code: l.invalid_string,
          message: i.message
        }), r.dirty());
      else if (i.kind === "ulid")
        at.test(e.data) || (s = this._getOrReturnCtx(e, s), u(s, {
          validation: "ulid",
          code: l.invalid_string,
          message: i.message
        }), r.dirty());
      else if (i.kind === "url")
        try {
          new URL(e.data);
        } catch {
          s = this._getOrReturnCtx(e, s), u(s, {
            validation: "url",
            code: l.invalid_string,
            message: i.message
          }), r.dirty();
        }
      else i.kind === "regex" ? (i.regex.lastIndex = 0, i.regex.test(e.data) || (s = this._getOrReturnCtx(e, s), u(s, {
        validation: "regex",
        code: l.invalid_string,
        message: i.message
      }), r.dirty())) : i.kind === "trim" ? e.data = e.data.trim() : i.kind === "includes" ? e.data.includes(i.value, i.position) || (s = this._getOrReturnCtx(e, s), u(s, {
        code: l.invalid_string,
        validation: { includes: i.value, position: i.position },
        message: i.message
      }), r.dirty()) : i.kind === "toLowerCase" ? e.data = e.data.toLowerCase() : i.kind === "toUpperCase" ? e.data = e.data.toUpperCase() : i.kind === "startsWith" ? e.data.startsWith(i.value) || (s = this._getOrReturnCtx(e, s), u(s, {
        code: l.invalid_string,
        validation: { startsWith: i.value },
        message: i.message
      }), r.dirty()) : i.kind === "endsWith" ? e.data.endsWith(i.value) || (s = this._getOrReturnCtx(e, s), u(s, {
        code: l.invalid_string,
        validation: { endsWith: i.value },
        message: i.message
      }), r.dirty()) : i.kind === "datetime" ? bt(i).test(e.data) || (s = this._getOrReturnCtx(e, s), u(s, {
        code: l.invalid_string,
        validation: "datetime",
        message: i.message
      }), r.dirty()) : i.kind === "date" ? vt.test(e.data) || (s = this._getOrReturnCtx(e, s), u(s, {
        code: l.invalid_string,
        validation: "date",
        message: i.message
      }), r.dirty()) : i.kind === "time" ? kt(i).test(e.data) || (s = this._getOrReturnCtx(e, s), u(s, {
        code: l.invalid_string,
        validation: "time",
        message: i.message
      }), r.dirty()) : i.kind === "duration" ? dt.test(e.data) || (s = this._getOrReturnCtx(e, s), u(s, {
        validation: "duration",
        code: l.invalid_string,
        message: i.message
      }), r.dirty()) : i.kind === "ip" ? xt(e.data, i.version) || (s = this._getOrReturnCtx(e, s), u(s, {
        validation: "ip",
        code: l.invalid_string,
        message: i.message
      }), r.dirty()) : i.kind === "jwt" ? wt(e.data, i.alg) || (s = this._getOrReturnCtx(e, s), u(s, {
        validation: "jwt",
        code: l.invalid_string,
        message: i.message
      }), r.dirty()) : i.kind === "cidr" ? St(e.data, i.version) || (s = this._getOrReturnCtx(e, s), u(s, {
        validation: "cidr",
        code: l.invalid_string,
        message: i.message
      }), r.dirty()) : i.kind === "base64" ? gt.test(e.data) || (s = this._getOrReturnCtx(e, s), u(s, {
        validation: "base64",
        code: l.invalid_string,
        message: i.message
      }), r.dirty()) : i.kind === "base64url" ? yt.test(e.data) || (s = this._getOrReturnCtx(e, s), u(s, {
        validation: "base64url",
        code: l.invalid_string,
        message: i.message
      }), r.dirty()) : k.assertNever(i);
    return { status: r.value, value: e.data };
  }
  _regex(e, t, r) {
    return this.refinement((s) => e.test(s), {
      validation: t,
      code: l.invalid_string,
      ...f.errToObj(r)
    });
  }
  _addCheck(e) {
    return new R({
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
    return new R({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }]
    });
  }
  toLowerCase() {
    return new R({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }]
    });
  }
  toUpperCase() {
    return new R({
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
R.create = (n) => new R({
  checks: [],
  typeName: m.ZodString,
  coerce: (n == null ? void 0 : n.coerce) ?? !1,
  ...y(n)
});
function Tt(n, e) {
  const t = (n.toString().split(".")[1] || "").length, r = (e.toString().split(".")[1] || "").length, s = t > r ? t : r, i = Number.parseInt(n.toFixed(s).replace(".", "")), a = Number.parseInt(e.toFixed(s).replace(".", ""));
  return i % a / 10 ** s;
}
class B extends v {
  constructor() {
    super(...arguments), this.min = this.gte, this.max = this.lte, this.step = this.multipleOf;
  }
  _parse(e) {
    if (this._def.coerce && (e.data = Number(e.data)), this._getType(e) !== p.number) {
      const i = this._getOrReturnCtx(e);
      return u(i, {
        code: l.invalid_type,
        expected: p.number,
        received: i.parsedType
      }), g;
    }
    let r;
    const s = new S();
    for (const i of this._def.checks)
      i.kind === "int" ? k.isInteger(e.data) || (r = this._getOrReturnCtx(e, r), u(r, {
        code: l.invalid_type,
        expected: "integer",
        received: "float",
        message: i.message
      }), s.dirty()) : i.kind === "min" ? (i.inclusive ? e.data < i.value : e.data <= i.value) && (r = this._getOrReturnCtx(e, r), u(r, {
        code: l.too_small,
        minimum: i.value,
        type: "number",
        inclusive: i.inclusive,
        exact: !1,
        message: i.message
      }), s.dirty()) : i.kind === "max" ? (i.inclusive ? e.data > i.value : e.data >= i.value) && (r = this._getOrReturnCtx(e, r), u(r, {
        code: l.too_big,
        maximum: i.value,
        type: "number",
        inclusive: i.inclusive,
        exact: !1,
        message: i.message
      }), s.dirty()) : i.kind === "multipleOf" ? Tt(e.data, i.value) !== 0 && (r = this._getOrReturnCtx(e, r), u(r, {
        code: l.not_multiple_of,
        multipleOf: i.value,
        message: i.message
      }), s.dirty()) : i.kind === "finite" ? Number.isFinite(e.data) || (r = this._getOrReturnCtx(e, r), u(r, {
        code: l.not_finite,
        message: i.message
      }), s.dirty()) : k.assertNever(i);
    return { status: s.value, value: e.data };
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
  setLimit(e, t, r, s) {
    return new B({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind: e,
          value: t,
          inclusive: r,
          message: f.toString(s)
        }
      ]
    });
  }
  _addCheck(e) {
    return new B({
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
    return !!this._def.checks.find((e) => e.kind === "int" || e.kind === "multipleOf" && k.isInteger(e.value));
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
B.create = (n) => new B({
  checks: [],
  typeName: m.ZodNumber,
  coerce: (n == null ? void 0 : n.coerce) || !1,
  ...y(n)
});
class G extends v {
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
    if (this._getType(e) !== p.bigint)
      return this._getInvalidInput(e);
    let r;
    const s = new S();
    for (const i of this._def.checks)
      i.kind === "min" ? (i.inclusive ? e.data < i.value : e.data <= i.value) && (r = this._getOrReturnCtx(e, r), u(r, {
        code: l.too_small,
        type: "bigint",
        minimum: i.value,
        inclusive: i.inclusive,
        message: i.message
      }), s.dirty()) : i.kind === "max" ? (i.inclusive ? e.data > i.value : e.data >= i.value) && (r = this._getOrReturnCtx(e, r), u(r, {
        code: l.too_big,
        type: "bigint",
        maximum: i.value,
        inclusive: i.inclusive,
        message: i.message
      }), s.dirty()) : i.kind === "multipleOf" ? e.data % i.value !== BigInt(0) && (r = this._getOrReturnCtx(e, r), u(r, {
        code: l.not_multiple_of,
        multipleOf: i.value,
        message: i.message
      }), s.dirty()) : k.assertNever(i);
    return { status: s.value, value: e.data };
  }
  _getInvalidInput(e) {
    const t = this._getOrReturnCtx(e);
    return u(t, {
      code: l.invalid_type,
      expected: p.bigint,
      received: t.parsedType
    }), g;
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
  setLimit(e, t, r, s) {
    return new G({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind: e,
          value: t,
          inclusive: r,
          message: f.toString(s)
        }
      ]
    });
  }
  _addCheck(e) {
    return new G({
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
G.create = (n) => new G({
  checks: [],
  typeName: m.ZodBigInt,
  coerce: (n == null ? void 0 : n.coerce) ?? !1,
  ...y(n)
});
class pe extends v {
  _parse(e) {
    if (this._def.coerce && (e.data = !!e.data), this._getType(e) !== p.boolean) {
      const r = this._getOrReturnCtx(e);
      return u(r, {
        code: l.invalid_type,
        expected: p.boolean,
        received: r.parsedType
      }), g;
    }
    return C(e.data);
  }
}
pe.create = (n) => new pe({
  typeName: m.ZodBoolean,
  coerce: (n == null ? void 0 : n.coerce) || !1,
  ...y(n)
});
class ne extends v {
  _parse(e) {
    if (this._def.coerce && (e.data = new Date(e.data)), this._getType(e) !== p.date) {
      const i = this._getOrReturnCtx(e);
      return u(i, {
        code: l.invalid_type,
        expected: p.date,
        received: i.parsedType
      }), g;
    }
    if (Number.isNaN(e.data.getTime())) {
      const i = this._getOrReturnCtx(e);
      return u(i, {
        code: l.invalid_date
      }), g;
    }
    const r = new S();
    let s;
    for (const i of this._def.checks)
      i.kind === "min" ? e.data.getTime() < i.value && (s = this._getOrReturnCtx(e, s), u(s, {
        code: l.too_small,
        message: i.message,
        inclusive: !0,
        exact: !1,
        minimum: i.value,
        type: "date"
      }), r.dirty()) : i.kind === "max" ? e.data.getTime() > i.value && (s = this._getOrReturnCtx(e, s), u(s, {
        code: l.too_big,
        message: i.message,
        inclusive: !0,
        exact: !1,
        maximum: i.value,
        type: "date"
      }), r.dirty()) : k.assertNever(i);
    return {
      status: r.value,
      value: new Date(e.data.getTime())
    };
  }
  _addCheck(e) {
    return new ne({
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
ne.create = (n) => new ne({
  checks: [],
  coerce: (n == null ? void 0 : n.coerce) || !1,
  typeName: m.ZodDate,
  ...y(n)
});
class Ce extends v {
  _parse(e) {
    if (this._getType(e) !== p.symbol) {
      const r = this._getOrReturnCtx(e);
      return u(r, {
        code: l.invalid_type,
        expected: p.symbol,
        received: r.parsedType
      }), g;
    }
    return C(e.data);
  }
}
Ce.create = (n) => new Ce({
  typeName: m.ZodSymbol,
  ...y(n)
});
class qe extends v {
  _parse(e) {
    if (this._getType(e) !== p.undefined) {
      const r = this._getOrReturnCtx(e);
      return u(r, {
        code: l.invalid_type,
        expected: p.undefined,
        received: r.parsedType
      }), g;
    }
    return C(e.data);
  }
}
qe.create = (n) => new qe({
  typeName: m.ZodUndefined,
  ...y(n)
});
class Ee extends v {
  _parse(e) {
    if (this._getType(e) !== p.null) {
      const r = this._getOrReturnCtx(e);
      return u(r, {
        code: l.invalid_type,
        expected: p.null,
        received: r.parsedType
      }), g;
    }
    return C(e.data);
  }
}
Ee.create = (n) => new Ee({
  typeName: m.ZodNull,
  ...y(n)
});
class Ie extends v {
  constructor() {
    super(...arguments), this._any = !0;
  }
  _parse(e) {
    return C(e.data);
  }
}
Ie.create = (n) => new Ie({
  typeName: m.ZodAny,
  ...y(n)
});
class fe extends v {
  constructor() {
    super(...arguments), this._unknown = !0;
  }
  _parse(e) {
    return C(e.data);
  }
}
fe.create = (n) => new fe({
  typeName: m.ZodUnknown,
  ...y(n)
});
class M extends v {
  _parse(e) {
    const t = this._getOrReturnCtx(e);
    return u(t, {
      code: l.invalid_type,
      expected: p.never,
      received: t.parsedType
    }), g;
  }
}
M.create = (n) => new M({
  typeName: m.ZodNever,
  ...y(n)
});
class Ae extends v {
  _parse(e) {
    if (this._getType(e) !== p.undefined) {
      const r = this._getOrReturnCtx(e);
      return u(r, {
        code: l.invalid_type,
        expected: p.void,
        received: r.parsedType
      }), g;
    }
    return C(e.data);
  }
}
Ae.create = (n) => new Ae({
  typeName: m.ZodVoid,
  ...y(n)
});
class I extends v {
  _parse(e) {
    const { ctx: t, status: r } = this._processInputParams(e), s = this._def;
    if (t.parsedType !== p.array)
      return u(t, {
        code: l.invalid_type,
        expected: p.array,
        received: t.parsedType
      }), g;
    if (s.exactLength !== null) {
      const a = t.data.length > s.exactLength.value, o = t.data.length < s.exactLength.value;
      (a || o) && (u(t, {
        code: a ? l.too_big : l.too_small,
        minimum: o ? s.exactLength.value : void 0,
        maximum: a ? s.exactLength.value : void 0,
        type: "array",
        inclusive: !0,
        exact: !0,
        message: s.exactLength.message
      }), r.dirty());
    }
    if (s.minLength !== null && t.data.length < s.minLength.value && (u(t, {
      code: l.too_small,
      minimum: s.minLength.value,
      type: "array",
      inclusive: !0,
      exact: !1,
      message: s.minLength.message
    }), r.dirty()), s.maxLength !== null && t.data.length > s.maxLength.value && (u(t, {
      code: l.too_big,
      maximum: s.maxLength.value,
      type: "array",
      inclusive: !0,
      exact: !1,
      message: s.maxLength.message
    }), r.dirty()), t.common.async)
      return Promise.all([...t.data].map((a, o) => s.type._parseAsync(new O(t, a, t.path, o)))).then((a) => S.mergeArray(r, a));
    const i = [...t.data].map((a, o) => s.type._parseSync(new O(t, a, t.path, o)));
    return S.mergeArray(r, i);
  }
  get element() {
    return this._def.type;
  }
  min(e, t) {
    return new I({
      ...this._def,
      minLength: { value: e, message: f.toString(t) }
    });
  }
  max(e, t) {
    return new I({
      ...this._def,
      maxLength: { value: e, message: f.toString(t) }
    });
  }
  length(e, t) {
    return new I({
      ...this._def,
      exactLength: { value: e, message: f.toString(t) }
    });
  }
  nonempty(e) {
    return this.min(1, e);
  }
}
I.create = (n, e) => new I({
  type: n,
  minLength: null,
  maxLength: null,
  exactLength: null,
  typeName: m.ZodArray,
  ...y(e)
});
function D(n) {
  if (n instanceof x) {
    const e = {};
    for (const t in n.shape) {
      const r = n.shape[t];
      e[t] = $.create(D(r));
    }
    return new x({
      ...n._def,
      shape: () => e
    });
  } else return n instanceof I ? new I({
    ...n._def,
    type: D(n.element)
  }) : n instanceof $ ? $.create(D(n.unwrap())) : n instanceof U ? U.create(D(n.unwrap())) : n instanceof L ? L.create(n.items.map((e) => D(e))) : n;
}
class x extends v {
  constructor() {
    super(...arguments), this._cached = null, this.nonstrict = this.passthrough, this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null)
      return this._cached;
    const e = this._def.shape(), t = k.objectKeys(e);
    return this._cached = { shape: e, keys: t }, this._cached;
  }
  _parse(e) {
    if (this._getType(e) !== p.object) {
      const d = this._getOrReturnCtx(e);
      return u(d, {
        code: l.invalid_type,
        expected: p.object,
        received: d.parsedType
      }), g;
    }
    const { status: r, ctx: s } = this._processInputParams(e), { shape: i, keys: a } = this._getCached(), o = [];
    if (!(this._def.catchall instanceof M && this._def.unknownKeys === "strip"))
      for (const d in s.data)
        a.includes(d) || o.push(d);
    const c = [];
    for (const d of a) {
      const _ = i[d], T = s.data[d];
      c.push({
        key: { status: "valid", value: d },
        value: _._parse(new O(s, T, s.path, d)),
        alwaysSet: d in s.data
      });
    }
    if (this._def.catchall instanceof M) {
      const d = this._def.unknownKeys;
      if (d === "passthrough")
        for (const _ of o)
          c.push({
            key: { status: "valid", value: _ },
            value: { status: "valid", value: s.data[_] }
          });
      else if (d === "strict")
        o.length > 0 && (u(s, {
          code: l.unrecognized_keys,
          keys: o
        }), r.dirty());
      else if (d !== "strip") throw new Error("Internal ZodObject error: invalid unknownKeys value.");
    } else {
      const d = this._def.catchall;
      for (const _ of o) {
        const T = s.data[_];
        c.push({
          key: { status: "valid", value: _ },
          value: d._parse(
            new O(s, T, s.path, _)
            //, ctx.child(key), value, getParsedType(value)
          ),
          alwaysSet: _ in s.data
        });
      }
    }
    return s.common.async ? Promise.resolve().then(async () => {
      const d = [];
      for (const _ of c) {
        const T = await _.key, w = await _.value;
        d.push({
          key: T,
          value: w,
          alwaysSet: _.alwaysSet
        });
      }
      return d;
    }).then((d) => S.mergeObjectSync(r, d)) : S.mergeObjectSync(r, c);
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
          var i, a;
          const s = ((a = (i = this._def).errorMap) == null ? void 0 : a.call(i, t, r).message) ?? r.defaultError;
          return t.code === "unrecognized_keys" ? {
            message: f.errToObj(e).message ?? s
          } : {
            message: s
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
    for (const r of k.objectKeys(e))
      e[r] && this.shape[r] && (t[r] = this.shape[r]);
    return new x({
      ...this._def,
      shape: () => t
    });
  }
  omit(e) {
    const t = {};
    for (const r of k.objectKeys(this.shape))
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
    return D(this);
  }
  partial(e) {
    const t = {};
    for (const r of k.objectKeys(this.shape)) {
      const s = this.shape[r];
      e && !e[r] ? t[r] = s : t[r] = s.optional();
    }
    return new x({
      ...this._def,
      shape: () => t
    });
  }
  required(e) {
    const t = {};
    for (const r of k.objectKeys(this.shape))
      if (e && !e[r])
        t[r] = this.shape[r];
      else {
        let i = this.shape[r];
        for (; i instanceof $; )
          i = i._def.innerType;
        t[r] = i;
      }
    return new x({
      ...this._def,
      shape: () => t
    });
  }
  keyof() {
    return Pe(k.objectKeys(this.shape));
  }
}
x.create = (n, e) => new x({
  shape: () => n,
  unknownKeys: "strip",
  catchall: M.create(),
  typeName: m.ZodObject,
  ...y(e)
});
x.strictCreate = (n, e) => new x({
  shape: () => n,
  unknownKeys: "strict",
  catchall: M.create(),
  typeName: m.ZodObject,
  ...y(e)
});
x.lazycreate = (n, e) => new x({
  shape: n,
  unknownKeys: "strip",
  catchall: M.create(),
  typeName: m.ZodObject,
  ...y(e)
});
class re extends v {
  _parse(e) {
    const { ctx: t } = this._processInputParams(e), r = this._def.options;
    function s(i) {
      for (const o of i)
        if (o.result.status === "valid")
          return o.result;
      for (const o of i)
        if (o.result.status === "dirty")
          return t.common.issues.push(...o.ctx.common.issues), o.result;
      const a = i.map((o) => new j(o.ctx.common.issues));
      return u(t, {
        code: l.invalid_union,
        unionErrors: a
      }), g;
    }
    if (t.common.async)
      return Promise.all(r.map(async (i) => {
        const a = {
          ...t,
          common: {
            ...t.common,
            issues: []
          },
          parent: null
        };
        return {
          result: await i._parseAsync({
            data: t.data,
            path: t.path,
            parent: a
          }),
          ctx: a
        };
      })).then(s);
    {
      let i;
      const a = [];
      for (const c of r) {
        const d = {
          ...t,
          common: {
            ...t.common,
            issues: []
          },
          parent: null
        }, _ = c._parseSync({
          data: t.data,
          path: t.path,
          parent: d
        });
        if (_.status === "valid")
          return _;
        _.status === "dirty" && !i && (i = { result: _, ctx: d }), d.common.issues.length && a.push(d.common.issues);
      }
      if (i)
        return t.common.issues.push(...i.ctx.common.issues), i.result;
      const o = a.map((c) => new j(c));
      return u(t, {
        code: l.invalid_union,
        unionErrors: o
      }), g;
    }
  }
  get options() {
    return this._def.options;
  }
}
re.create = (n, e) => new re({
  options: n,
  typeName: m.ZodUnion,
  ...y(e)
});
function he(n, e) {
  const t = Z(n), r = Z(e);
  if (n === e)
    return { valid: !0, data: n };
  if (t === p.object && r === p.object) {
    const s = k.objectKeys(e), i = k.objectKeys(n).filter((o) => s.indexOf(o) !== -1), a = { ...n, ...e };
    for (const o of i) {
      const c = he(n[o], e[o]);
      if (!c.valid)
        return { valid: !1 };
      a[o] = c.data;
    }
    return { valid: !0, data: a };
  } else if (t === p.array && r === p.array) {
    if (n.length !== e.length)
      return { valid: !1 };
    const s = [];
    for (let i = 0; i < n.length; i++) {
      const a = n[i], o = e[i], c = he(a, o);
      if (!c.valid)
        return { valid: !1 };
      s.push(c.data);
    }
    return { valid: !0, data: s };
  } else return t === p.date && r === p.date && +n == +e ? { valid: !0, data: n } : { valid: !1 };
}
class se extends v {
  _parse(e) {
    const { status: t, ctx: r } = this._processInputParams(e), s = (i, a) => {
      if (we(i) || we(a))
        return g;
      const o = he(i.value, a.value);
      return o.valid ? ((Se(i) || Se(a)) && t.dirty(), { status: t.value, value: o.data }) : (u(r, {
        code: l.invalid_intersection_types
      }), g);
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
    ]).then(([i, a]) => s(i, a)) : s(this._def.left._parseSync({
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
se.create = (n, e, t) => new se({
  left: n,
  right: e,
  typeName: m.ZodIntersection,
  ...y(t)
});
class L extends v {
  _parse(e) {
    const { status: t, ctx: r } = this._processInputParams(e);
    if (r.parsedType !== p.array)
      return u(r, {
        code: l.invalid_type,
        expected: p.array,
        received: r.parsedType
      }), g;
    if (r.data.length < this._def.items.length)
      return u(r, {
        code: l.too_small,
        minimum: this._def.items.length,
        inclusive: !0,
        exact: !1,
        type: "array"
      }), g;
    !this._def.rest && r.data.length > this._def.items.length && (u(r, {
      code: l.too_big,
      maximum: this._def.items.length,
      inclusive: !0,
      exact: !1,
      type: "array"
    }), t.dirty());
    const i = [...r.data].map((a, o) => {
      const c = this._def.items[o] || this._def.rest;
      return c ? c._parse(new O(r, a, r.path, o)) : null;
    }).filter((a) => !!a);
    return r.common.async ? Promise.all(i).then((a) => S.mergeArray(t, a)) : S.mergeArray(t, i);
  }
  get items() {
    return this._def.items;
  }
  rest(e) {
    return new L({
      ...this._def,
      rest: e
    });
  }
}
L.create = (n, e) => {
  if (!Array.isArray(n))
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  return new L({
    items: n,
    typeName: m.ZodTuple,
    rest: null,
    ...y(e)
  });
};
class ie extends v {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(e) {
    const { status: t, ctx: r } = this._processInputParams(e);
    if (r.parsedType !== p.object)
      return u(r, {
        code: l.invalid_type,
        expected: p.object,
        received: r.parsedType
      }), g;
    const s = [], i = this._def.keyType, a = this._def.valueType;
    for (const o in r.data)
      s.push({
        key: i._parse(new O(r, o, r.path, o)),
        value: a._parse(new O(r, r.data[o], r.path, o)),
        alwaysSet: o in r.data
      });
    return r.common.async ? S.mergeObjectAsync(t, s) : S.mergeObjectSync(t, s);
  }
  get element() {
    return this._def.valueType;
  }
  static create(e, t, r) {
    return t instanceof v ? new ie({
      keyType: e,
      valueType: t,
      typeName: m.ZodRecord,
      ...y(r)
    }) : new ie({
      keyType: R.create(),
      valueType: e,
      typeName: m.ZodRecord,
      ...y(t)
    });
  }
}
class Oe extends v {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(e) {
    const { status: t, ctx: r } = this._processInputParams(e);
    if (r.parsedType !== p.map)
      return u(r, {
        code: l.invalid_type,
        expected: p.map,
        received: r.parsedType
      }), g;
    const s = this._def.keyType, i = this._def.valueType, a = [...r.data.entries()].map(([o, c], d) => ({
      key: s._parse(new O(r, o, r.path, [d, "key"])),
      value: i._parse(new O(r, c, r.path, [d, "value"]))
    }));
    if (r.common.async) {
      const o = /* @__PURE__ */ new Map();
      return Promise.resolve().then(async () => {
        for (const c of a) {
          const d = await c.key, _ = await c.value;
          if (d.status === "aborted" || _.status === "aborted")
            return g;
          (d.status === "dirty" || _.status === "dirty") && t.dirty(), o.set(d.value, _.value);
        }
        return { status: t.value, value: o };
      });
    } else {
      const o = /* @__PURE__ */ new Map();
      for (const c of a) {
        const d = c.key, _ = c.value;
        if (d.status === "aborted" || _.status === "aborted")
          return g;
        (d.status === "dirty" || _.status === "dirty") && t.dirty(), o.set(d.value, _.value);
      }
      return { status: t.value, value: o };
    }
  }
}
Oe.create = (n, e, t) => new Oe({
  valueType: e,
  keyType: n,
  typeName: m.ZodMap,
  ...y(t)
});
class J extends v {
  _parse(e) {
    const { status: t, ctx: r } = this._processInputParams(e);
    if (r.parsedType !== p.set)
      return u(r, {
        code: l.invalid_type,
        expected: p.set,
        received: r.parsedType
      }), g;
    const s = this._def;
    s.minSize !== null && r.data.size < s.minSize.value && (u(r, {
      code: l.too_small,
      minimum: s.minSize.value,
      type: "set",
      inclusive: !0,
      exact: !1,
      message: s.minSize.message
    }), t.dirty()), s.maxSize !== null && r.data.size > s.maxSize.value && (u(r, {
      code: l.too_big,
      maximum: s.maxSize.value,
      type: "set",
      inclusive: !0,
      exact: !1,
      message: s.maxSize.message
    }), t.dirty());
    const i = this._def.valueType;
    function a(c) {
      const d = /* @__PURE__ */ new Set();
      for (const _ of c) {
        if (_.status === "aborted")
          return g;
        _.status === "dirty" && t.dirty(), d.add(_.value);
      }
      return { status: t.value, value: d };
    }
    const o = [...r.data.values()].map((c, d) => i._parse(new O(r, c, r.path, d)));
    return r.common.async ? Promise.all(o).then((c) => a(c)) : a(o);
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
  ...y(e)
});
class Ne extends v {
  get schema() {
    return this._def.getter();
  }
  _parse(e) {
    const { ctx: t } = this._processInputParams(e);
    return this._def.getter()._parse({ data: t.data, path: t.path, parent: t });
  }
}
Ne.create = (n, e) => new Ne({
  getter: n,
  typeName: m.ZodLazy,
  ...y(e)
});
class Re extends v {
  _parse(e) {
    if (e.data !== this._def.value) {
      const t = this._getOrReturnCtx(e);
      return u(t, {
        received: t.data,
        code: l.invalid_literal,
        expected: this._def.value
      }), g;
    }
    return { status: "valid", value: e.data };
  }
  get value() {
    return this._def.value;
  }
}
Re.create = (n, e) => new Re({
  value: n,
  typeName: m.ZodLiteral,
  ...y(e)
});
function Pe(n, e) {
  return new F({
    values: n,
    typeName: m.ZodEnum,
    ...y(e)
  });
}
class F extends v {
  _parse(e) {
    if (typeof e.data != "string") {
      const t = this._getOrReturnCtx(e), r = this._def.values;
      return u(t, {
        expected: k.joinValues(r),
        received: t.parsedType,
        code: l.invalid_type
      }), g;
    }
    if (this._cache || (this._cache = new Set(this._def.values)), !this._cache.has(e.data)) {
      const t = this._getOrReturnCtx(e), r = this._def.values;
      return u(t, {
        received: t.data,
        code: l.invalid_enum_value,
        options: r
      }), g;
    }
    return C(e.data);
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
    return F.create(e, {
      ...this._def,
      ...t
    });
  }
  exclude(e, t = this._def) {
    return F.create(this.options.filter((r) => !e.includes(r)), {
      ...this._def,
      ...t
    });
  }
}
F.create = Pe;
class je extends v {
  _parse(e) {
    const t = k.getValidEnumValues(this._def.values), r = this._getOrReturnCtx(e);
    if (r.parsedType !== p.string && r.parsedType !== p.number) {
      const s = k.objectValues(t);
      return u(r, {
        expected: k.joinValues(s),
        received: r.parsedType,
        code: l.invalid_type
      }), g;
    }
    if (this._cache || (this._cache = new Set(k.getValidEnumValues(this._def.values))), !this._cache.has(e.data)) {
      const s = k.objectValues(t);
      return u(r, {
        received: r.data,
        code: l.invalid_enum_value,
        options: s
      }), g;
    }
    return C(e.data);
  }
  get enum() {
    return this._def.values;
  }
}
je.create = (n, e) => new je({
  values: n,
  typeName: m.ZodNativeEnum,
  ...y(e)
});
class ae extends v {
  unwrap() {
    return this._def.type;
  }
  _parse(e) {
    const { ctx: t } = this._processInputParams(e);
    if (t.parsedType !== p.promise && t.common.async === !1)
      return u(t, {
        code: l.invalid_type,
        expected: p.promise,
        received: t.parsedType
      }), g;
    const r = t.parsedType === p.promise ? t.data : Promise.resolve(t.data);
    return C(r.then((s) => this._def.type.parseAsync(s, {
      path: t.path,
      errorMap: t.common.contextualErrorMap
    })));
  }
}
ae.create = (n, e) => new ae({
  type: n,
  typeName: m.ZodPromise,
  ...y(e)
});
class z extends v {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === m.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(e) {
    const { status: t, ctx: r } = this._processInputParams(e), s = this._def.effect || null, i = {
      addIssue: (a) => {
        u(r, a), a.fatal ? t.abort() : t.dirty();
      },
      get path() {
        return r.path;
      }
    };
    if (i.addIssue = i.addIssue.bind(i), s.type === "preprocess") {
      const a = s.transform(r.data, i);
      if (r.common.async)
        return Promise.resolve(a).then(async (o) => {
          if (t.value === "aborted")
            return g;
          const c = await this._def.schema._parseAsync({
            data: o,
            path: r.path,
            parent: r
          });
          return c.status === "aborted" ? g : c.status === "dirty" || t.value === "dirty" ? H(c.value) : c;
        });
      {
        if (t.value === "aborted")
          return g;
        const o = this._def.schema._parseSync({
          data: a,
          path: r.path,
          parent: r
        });
        return o.status === "aborted" ? g : o.status === "dirty" || t.value === "dirty" ? H(o.value) : o;
      }
    }
    if (s.type === "refinement") {
      const a = (o) => {
        const c = s.refinement(o, i);
        if (r.common.async)
          return Promise.resolve(c);
        if (c instanceof Promise)
          throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        return o;
      };
      if (r.common.async === !1) {
        const o = this._def.schema._parseSync({
          data: r.data,
          path: r.path,
          parent: r
        });
        return o.status === "aborted" ? g : (o.status === "dirty" && t.dirty(), a(o.value), { status: t.value, value: o.value });
      } else
        return this._def.schema._parseAsync({ data: r.data, path: r.path, parent: r }).then((o) => o.status === "aborted" ? g : (o.status === "dirty" && t.dirty(), a(o.value).then(() => ({ status: t.value, value: o.value }))));
    }
    if (s.type === "transform")
      if (r.common.async === !1) {
        const a = this._def.schema._parseSync({
          data: r.data,
          path: r.path,
          parent: r
        });
        if (!V(a))
          return g;
        const o = s.transform(a.value, i);
        if (o instanceof Promise)
          throw new Error("Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.");
        return { status: t.value, value: o };
      } else
        return this._def.schema._parseAsync({ data: r.data, path: r.path, parent: r }).then((a) => V(a) ? Promise.resolve(s.transform(a.value, i)).then((o) => ({
          status: t.value,
          value: o
        })) : g);
    k.assertNever(s);
  }
}
z.create = (n, e, t) => new z({
  schema: n,
  typeName: m.ZodEffects,
  effect: e,
  ...y(t)
});
z.createWithPreprocess = (n, e, t) => new z({
  schema: e,
  effect: { type: "preprocess", transform: n },
  typeName: m.ZodEffects,
  ...y(t)
});
class $ extends v {
  _parse(e) {
    return this._getType(e) === p.undefined ? C(void 0) : this._def.innerType._parse(e);
  }
  unwrap() {
    return this._def.innerType;
  }
}
$.create = (n, e) => new $({
  innerType: n,
  typeName: m.ZodOptional,
  ...y(e)
});
class U extends v {
  _parse(e) {
    return this._getType(e) === p.null ? C(null) : this._def.innerType._parse(e);
  }
  unwrap() {
    return this._def.innerType;
  }
}
U.create = (n, e) => new U({
  innerType: n,
  typeName: m.ZodNullable,
  ...y(e)
});
class _e extends v {
  _parse(e) {
    const { ctx: t } = this._processInputParams(e);
    let r = t.data;
    return t.parsedType === p.undefined && (r = this._def.defaultValue()), this._def.innerType._parse({
      data: r,
      path: t.path,
      parent: t
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
}
_e.create = (n, e) => new _e({
  innerType: n,
  typeName: m.ZodDefault,
  defaultValue: typeof e.default == "function" ? e.default : () => e.default,
  ...y(e)
});
class me extends v {
  _parse(e) {
    const { ctx: t } = this._processInputParams(e), r = {
      ...t,
      common: {
        ...t.common,
        issues: []
      }
    }, s = this._def.innerType._parse({
      data: r.data,
      path: r.path,
      parent: {
        ...r
      }
    });
    return te(s) ? s.then((i) => ({
      status: "valid",
      value: i.status === "valid" ? i.value : this._def.catchValue({
        get error() {
          return new j(r.common.issues);
        },
        input: r.data
      })
    })) : {
      status: "valid",
      value: s.status === "valid" ? s.value : this._def.catchValue({
        get error() {
          return new j(r.common.issues);
        },
        input: r.data
      })
    };
  }
  removeCatch() {
    return this._def.innerType;
  }
}
me.create = (n, e) => new me({
  innerType: n,
  typeName: m.ZodCatch,
  catchValue: typeof e.catch == "function" ? e.catch : () => e.catch,
  ...y(e)
});
class Ze extends v {
  _parse(e) {
    if (this._getType(e) !== p.nan) {
      const r = this._getOrReturnCtx(e);
      return u(r, {
        code: l.invalid_type,
        expected: p.nan,
        received: r.parsedType
      }), g;
    }
    return { status: "valid", value: e.data };
  }
}
Ze.create = (n) => new Ze({
  typeName: m.ZodNaN,
  ...y(n)
});
class Ct extends v {
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
class ye extends v {
  _parse(e) {
    const { status: t, ctx: r } = this._processInputParams(e);
    if (r.common.async)
      return (async () => {
        const i = await this._def.in._parseAsync({
          data: r.data,
          path: r.path,
          parent: r
        });
        return i.status === "aborted" ? g : i.status === "dirty" ? (t.dirty(), H(i.value)) : this._def.out._parseAsync({
          data: i.value,
          path: r.path,
          parent: r
        });
      })();
    {
      const s = this._def.in._parseSync({
        data: r.data,
        path: r.path,
        parent: r
      });
      return s.status === "aborted" ? g : s.status === "dirty" ? (t.dirty(), {
        status: "dirty",
        value: s.value
      }) : this._def.out._parseSync({
        data: s.value,
        path: r.path,
        parent: r
      });
    }
  }
  static create(e, t) {
    return new ye({
      in: e,
      out: t,
      typeName: m.ZodPipeline
    });
  }
}
class ge extends v {
  _parse(e) {
    const t = this._def.innerType._parse(e), r = (s) => (V(s) && (s.value = Object.freeze(s.value)), s);
    return te(t) ? t.then((s) => r(s)) : r(t);
  }
  unwrap() {
    return this._def.innerType;
  }
}
ge.create = (n, e) => new ge({
  innerType: n,
  typeName: m.ZodReadonly,
  ...y(e)
});
var m;
(function(n) {
  n.ZodString = "ZodString", n.ZodNumber = "ZodNumber", n.ZodNaN = "ZodNaN", n.ZodBigInt = "ZodBigInt", n.ZodBoolean = "ZodBoolean", n.ZodDate = "ZodDate", n.ZodSymbol = "ZodSymbol", n.ZodUndefined = "ZodUndefined", n.ZodNull = "ZodNull", n.ZodAny = "ZodAny", n.ZodUnknown = "ZodUnknown", n.ZodNever = "ZodNever", n.ZodVoid = "ZodVoid", n.ZodArray = "ZodArray", n.ZodObject = "ZodObject", n.ZodUnion = "ZodUnion", n.ZodDiscriminatedUnion = "ZodDiscriminatedUnion", n.ZodIntersection = "ZodIntersection", n.ZodTuple = "ZodTuple", n.ZodRecord = "ZodRecord", n.ZodMap = "ZodMap", n.ZodSet = "ZodSet", n.ZodFunction = "ZodFunction", n.ZodLazy = "ZodLazy", n.ZodLiteral = "ZodLiteral", n.ZodEnum = "ZodEnum", n.ZodEffects = "ZodEffects", n.ZodNativeEnum = "ZodNativeEnum", n.ZodOptional = "ZodOptional", n.ZodNullable = "ZodNullable", n.ZodDefault = "ZodDefault", n.ZodCatch = "ZodCatch", n.ZodPromise = "ZodPromise", n.ZodBranded = "ZodBranded", n.ZodPipeline = "ZodPipeline", n.ZodReadonly = "ZodReadonly";
})(m || (m = {}));
const h = R.create, Y = B.create, ve = pe.create, ke = fe.create;
M.create;
const A = I.create, E = x.create;
re.create;
se.create;
L.create;
const X = ie.create, N = F.create;
ae.create;
$.create;
U.create;
const De = z.createWithPreprocess, qt = N(["log", "span", "metric"]), Et = N(["ok", "error", "unset"]), It = N(["counter", "gauge", "histogram", "summary"]), At = N([
  "json",
  "rpc",
  "protobuf",
  "text",
  "binary",
  "stream"
]), Ot = N(["raw", "base64", "gzip+base64", "protobuf"]), Nt = E({
  log_id: h().min(1),
  timestamp: h().datetime(),
  record_kind: qt,
  trace_id: h().min(1),
  span_id: h().min(1),
  parent_span_id: h().optional(),
  event_key: h().min(1),
  event_version: h().regex(/^\d{3}$/),
  span_name: h().optional(),
  start_time: h().datetime().optional(),
  end_time: h().datetime().optional(),
  status_code: Et.optional(),
  payload_format: At,
  payload_encoding: Ot,
  payload_masking_applied: ve(),
  payload_masked_fields: A(h()),
  payload: ke(),
  qa_session_id: h().optional(),
  // Address context
  address_context: X(h(), h()).optional(),
  // Metric (when record_kind === "metric")
  metric_type: It.optional(),
  metric_name: h().optional(),
  metric_value: Y().optional(),
  metric_unit: h().optional(),
  metric_labels: X(h(), h()).optional(),
  metric_buckets: A(Y()).optional(),
  metric_quantiles: A(Y()).optional(),
  actor_id: h().optional(),
  user_id: h().optional(),
  user_attributes: X(h()).optional()
}), Rt = N([
  "tenant",
  "workspace",
  "user",
  "agent"
]), jt = E({
  owner_type: Rt,
  owner_id: h().min(1)
}), Zt = E({
  service_name: h().min(1),
  sdk_name: h().min(1),
  sdk_version: h().min(1)
}), $t = E({
  platform: h().min(1),
  device_ref: h().optional(),
  os_version: h().optional(),
  app_version: h().optional()
}), Mt = h().min(1), Lt = E({
  env: Mt,
  build_ref: h().optional(),
  release_version: h().optional()
});
E({
  transmission_id: h().min(1),
  sent_at: h().datetime(),
  owner: jt,
  source: Zt,
  runtime: $t,
  build: Lt,
  infra_context: X(h(), h()).optional(),
  entry_snapshot: h().optional(),
  records: A(Nt).min(1)
});
const zt = N([
  "eq",
  "neq",
  "exists",
  "gt",
  "lt",
  "contains",
  "masked"
]), Ve = E({
  field: h().min(1),
  op: zt,
  value: ke().optional()
}), Pt = E({
  field: h().min(1),
  op: N(["eq", "neq", "exists", "gt", "lt", "contains"]),
  value: ke().optional()
}), Dt = E({
  condition: Ve,
  next: A(h().min(1))
}), Vt = N(["sequence", "optional", "branch"]), Bt = E({
  id: h().min(1),
  event_key: h().min(1),
  event_version: h().regex(/^\d{3}$/).optional(),
  source: h().optional(),
  record_kind: N(["log", "span"]).optional(),
  required: ve(),
  kind: Vt,
  constraints: A(Ve).optional(),
  timeout_ms: Y().int().positive().optional(),
  next: A(h().min(1)).optional(),
  branches: A(Dt).optional()
});
E({
  scenario_id: h().min(1),
  version: h().min(1),
  domain: h().min(1),
  description: h().optional(),
  entry_conditions: A(Pt).optional(),
  steps: A(Bt).min(1)
});
function ee(n) {
  const e = new Error(n);
  return e.source = "ulid", e;
}
const be = "0123456789ABCDEFGHJKMNPQRSTVWXYZ", K = be.length, $e = Math.pow(2, 48) - 1, Ft = 10, Ut = 16;
function Wt(n) {
  let e = Math.floor(n() * K);
  return e === K && (e = K - 1), be.charAt(e);
}
function Ht(n, e) {
  if (isNaN(n))
    throw new Error(n + " must be a number");
  if (n > $e)
    throw ee("cannot encode time greater than " + $e);
  if (n < 0)
    throw ee("time must be positive");
  if (Number.isInteger(Number(n)) === !1)
    throw ee("time must be an integer");
  let t, r = "";
  for (; e > 0; e--)
    t = n % K, r = be.charAt(t) + r, n = (n - t) / K;
  return r;
}
function Kt(n, e) {
  let t = "";
  for (; n > 0; n--)
    t = Wt(e) + t;
  return t;
}
function Gt(n = !1, e) {
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
  throw ee("secure crypto unusable, insecure Math.random not allowed");
}
function Jt(n) {
  return n || (n = Gt()), function(t) {
    return isNaN(t) && (t = Date.now()), Ht(t, Ft) + Kt(Ut, n);
  };
}
const Q = Jt();
function Qt() {
  return `txm_${Q()}`;
}
function de() {
  return `log_${Q()}`;
}
function Be() {
  return `trc_${Q()}`;
}
function Yt() {
  return `spn_${Q()}`;
}
function Xt() {
  return `qas_${Q()}`;
}
function P() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
const en = (n) => typeof n == "string" && n.trim().length === 0 ? void 0 : n;
De(en, h().url().optional());
De((n) => {
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
}, ve().default(!1));
class oe {
  constructor(e) {
    b(this, "trace_id");
    b(this, "spanStack", []);
    b(this, "qa_session_id");
    this.trace_id = (e == null ? void 0 : e.trace_id) ?? Be(), this.qa_session_id = e == null ? void 0 : e.qa_session_id;
  }
  /** Push a new span onto the stack. Returns the new span_id. */
  pushSpan(e) {
    const t = e ?? Yt();
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
function tn(n, e) {
  const t = { ...n }, r = [];
  for (const s of e)
    if (s.field in t)
      switch (r.push(s.field), s.mode) {
        case "raw":
          break;
        case "mask": {
          const i = {
            _masked: !0,
            _present: t[s.field] !== void 0 && t[s.field] !== null
          };
          t[s.field] = i;
          break;
        }
        case "drop":
          delete t[s.field];
          break;
        case "hash": {
          const i = t[s.field];
          t[s.field] = nn(String(i));
          break;
        }
      }
  return { masked: t, maskedFields: r };
}
function nn(n) {
  let e = 0;
  for (let t = 0; t < n.length; t++) {
    const r = n.charCodeAt(t);
    e = (e << 5) - e + r | 0;
  }
  return `h_${(e >>> 0).toString(16).padStart(8, "0")}`;
}
const rn = 50, sn = 5e3, an = 500;
class on {
  constructor(e) {
    b(this, "config");
    b(this, "batchSize");
    b(this, "flushIntervalMs");
    b(this, "maxBufferSize");
    b(this, "buffer", []);
    b(this, "flushTimer", null);
    b(this, "activeContext", null);
    b(this, "actor", null);
    /** Prevents concurrent flush calls (interval + batch-size trigger). */
    b(this, "flushInProgress", !1);
    this.config = e, this.batchSize = e.batchSize ?? rn, this.flushIntervalMs = e.flushIntervalMs ?? sn, this.maxBufferSize = e.maxBufferSize ?? an, this.flushIntervalMs > 0 && (this.flushTimer = setInterval(() => {
      this.flush().catch((t) => this.handleError(t, "interval-flush"));
    }, this.flushIntervalMs)), e.actor && (this.actor = e.actor);
  }
  // ── Context Management ─────────────────────────────
  /** Start a new trace context (or attach to existing trace). */
  startTrace(e) {
    return this.activeContext = new oe(e), this.activeContext;
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
    const t = this.ensureContext(), { payload: r, maskedFields: s, maskingApplied: i } = this.processPayload(e.payload), a = {
      log_id: de(),
      timestamp: P(),
      record_kind: "log",
      trace_id: t.trace_id,
      span_id: t.currentSpanId,
      parent_span_id: t.parentSpanId,
      event_key: e.event_key,
      event_version: e.event_version,
      payload_format: e.payload_format ?? "json",
      payload_encoding: e.payload_encoding ?? "raw",
      payload_masking_applied: i,
      payload_masked_fields: s,
      payload: r,
      qa_session_id: e.qa_session_id ?? t.qa_session_id,
      ...e.address_context ? { address_context: e.address_context } : {},
      ...this.actorFields()
    };
    return this.addRecord(a), a;
  }
  // ── Span ───────────────────────────────────────────
  /** Start a span. Returns a handle to end it. */
  startSpan(e) {
    const t = this.ensureContext(), r = t.pushSpan(), s = t.parentSpanId, i = P();
    return {
      span_id: r,
      end: (a) => {
        t.popSpan();
        const o = {
          ...e.payload,
          ...a == null ? void 0 : a.payload
        }, { payload: c, maskedFields: d, maskingApplied: _ } = this.processPayload(Object.keys(o).length > 0 ? o : void 0), T = {
          log_id: de(),
          timestamp: P(),
          record_kind: "span",
          trace_id: t.trace_id,
          span_id: r,
          parent_span_id: s,
          event_key: e.event_key,
          event_version: e.event_version,
          span_name: e.span_name,
          start_time: i,
          end_time: P(),
          status_code: (a == null ? void 0 : a.status_code) ?? "ok",
          payload_format: e.payload_format ?? "json",
          payload_encoding: e.payload_encoding ?? "raw",
          payload_masking_applied: _,
          payload_masked_fields: d,
          payload: c,
          qa_session_id: e.qa_session_id ?? t.qa_session_id,
          ...e.address_context ? { address_context: e.address_context } : {},
          ...this.actorFields()
        };
        return this.addRecord(T), T;
      }
    };
  }
  // ── Metric ──────────────────────────────────────────
  /** Record a metric event. */
  metric(e, t, r) {
    const s = this.ensureContext(), i = {
      log_id: de(),
      timestamp: P(),
      record_kind: "metric",
      trace_id: s.trace_id,
      span_id: s.currentSpanId,
      parent_span_id: s.parentSpanId,
      event_key: e,
      event_version: "1",
      payload_format: "json",
      payload_encoding: "raw",
      payload_masking_applied: !1,
      payload_masked_fields: [],
      payload: null,
      qa_session_id: s.qa_session_id,
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
    return this.addRecord(i), i;
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
        const i = r.splice(0, r.length - this.maxBufferSize);
        this.handleError(new Error(`[qa-sdk:flush] buffer overflow — dropped ${i.length} oldest records`), "buffer-overflow");
      }
      this.buffer = r;
      const s = t instanceof Error ? t : new Error(String(t));
      throw new Error(`[qa-sdk:flush] transport.send failed: ${s.message}`, { cause: s });
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
    return this.activeContext || (this.activeContext = new oe()), this.activeContext;
  }
  processPayload(e) {
    if (!e)
      return { payload: null, maskedFields: [], maskingApplied: !1 };
    const t = this.config.maskingRules;
    if (!t || t.length === 0)
      return { payload: e, maskedFields: [], maskingApplied: !1 };
    const { masked: r, maskedFields: s } = tn(e, t);
    return {
      payload: r,
      maskedFields: s,
      maskingApplied: s.length > 0
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
      transmission_id: Qt(),
      sent_at: P(),
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
function W(n) {
  var t;
  if (!n.name) throw new RangeError("PackFormat: name is required");
  if (n.chars <= 0) throw new RangeError(`PackFormat "${n.name}": chars must be > 0`);
  const e = (t = n.groups) != null && t.length ? Object.freeze([...n.groups]) : void 0;
  if (e) {
    const r = e.reduce((s, i) => s + i, 0);
    if (r !== n.chars)
      throw new RangeError(
        `PackFormat "${n.name}": groups sum (${r}) ≠ chars (${n.chars})`
      );
    if (e.some((s) => s <= 0))
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
W({ name: "int64", chars: 16, label: "64-bit Integer" }), W({ name: "objectId", chars: 24, label: "96-bit ObjectId" }), W({ name: "uuid", chars: 32, label: "UUID (128-bit)", groups: [8, 4, 4, 4, 12] }), W({ name: "sha1", chars: 40, label: "160-bit (SHA-1)" }), W({ name: "sha256", chars: 64, label: "256-bit (SHA-256)" });
const ln = [
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
], cn = [
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
], dn = [
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
], un = [
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
], pn = [
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
], fn = [
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
], hn = [
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
], _n = [
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
], Fe = [
  ...ln,
  ...cn,
  ...dn,
  ...un,
  ...pn,
  ...fn,
  ...hn,
  ..._n
], Ue = new Map(Fe.map((n) => [n.event_key, n]));
function mn(n) {
  return Ue.get(n);
}
Fe.filter((n) => n.auto_collectable);
const gn = [
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
new Map(gn.map((n) => [n.event_key, n]));
const yn = [
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
yn.map((n) => {
  const e = Ue.get(n);
  if (!e)
    throw new Error(`v1 minimal event not found in registry: ${n}`);
  return e;
});
class vn {
  constructor(e) {
    b(this, "endpoint");
    this.endpoint = e;
  }
  async send(e) {
    const t = JSON.stringify(e);
    if (typeof navigator < "u" && navigator.sendBeacon) {
      const s = new Blob([t], { type: "application/json" });
      if (navigator.sendBeacon(this.endpoint, s)) return;
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
const We = "qa_monitor";
function Me(n = We) {
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
    sessionId: Xt(),
    traceId: Be()
  };
  try {
    sessionStorage.setItem(n, JSON.stringify(e));
  } catch {
  }
  return e;
}
function kn(n = We) {
  try {
    sessionStorage.removeItem(n);
  } catch {
  }
}
function bn(n, e) {
  const t = [];
  if (n.clicks) {
    const r = (s) => {
      var o;
      const i = s.target;
      if (!i) return;
      const a = i.closest("button, a, [data-qa-event]");
      a && e("click", {
        tag: a.tagName.toLowerCase(),
        text: ((o = a.textContent) == null ? void 0 : o.trim().slice(0, 100)) ?? "",
        qa_id: a.dataset.qaId ?? a.id ?? void 0,
        href: a instanceof HTMLAnchorElement ? a.href : void 0,
        qa_event: a.dataset.qaEvent ?? void 0
      });
    };
    document.addEventListener("click", r, !0), t.push(() => document.removeEventListener("click", r, !0));
  }
  if (n.forms) {
    const r = (s) => {
      const i = s.target;
      if (!i) return;
      const a = new FormData(i), o = [];
      a.forEach((c, d) => o.push(d)), e("form_submit", {
        form_id: i.id || void 0,
        form_action: i.action || void 0,
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
    const s = history.pushState;
    history.pushState = function(...i) {
      s.call(history, ...i), e("page_view", { url: location.href });
    }, t.push(() => {
      history.pushState = s;
    });
  }
  return () => t.forEach((r) => r());
}
class xn {
  constructor(e) {
    b(this, "logger");
    b(this, "session");
    b(this, "storageKey");
    b(this, "destroyAutoCapture", null);
    b(this, "unloadHandler");
    b(this, "_status", "active");
    var o, c;
    this.storageKey = e.storageKey ?? "qa_monitor", this.session = Me(this.storageKey);
    const t = new vn(`${e.ingestUrl}/v1/ingest`), r = e.serviceConfig, s = r ? Je(r, "@qa-sdk/browser", "0.1.0") : { service_name: ((o = e.meta) == null ? void 0 : o.serviceName) ?? "browser", sdk_name: "@qa-sdk/browser", sdk_version: "0.1.0" }, i = r ? Qe(r) : { env: ((c = e.meta) == null ? void 0 : c.env) ?? "production" };
    this.logger = new on({
      transport: t,
      owner: e.owner ?? { owner_type: "tenant", owner_id: "browser-monitor" },
      source: s,
      runtime: {
        platform: "browser",
        os_version: typeof navigator < "u" ? navigator.userAgent : "unknown"
      },
      build: i,
      flushIntervalMs: 5e3,
      onError: e.onError,
      ...e.infraContext ? { infraContext: e.infraContext } : {},
      ...e.entrySnapshot ? { entrySnapshot: e.entrySnapshot } : {}
    });
    const a = new oe({
      trace_id: this.session.traceId,
      qa_session_id: this.session.sessionId
    });
    this.logger.setContext(a), e.scenarioId && this.emit("session_start", { scenario_id: e.scenarioId }), e.autoCapture && (this.destroyAutoCapture = bn(e.autoCapture, (d, _) => {
      this.emit(d, _);
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
    const s = mn(e), i = ((s == null ? void 0 : s.event_version) ?? "1").padStart(3, "0");
    this.logger.log({
      event_key: e,
      event_version: i,
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
    kn(this.storageKey);
    const e = Me(this.storageKey), t = new oe({
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
function En(n) {
  return new xn(n);
}
function wn(n, e, t) {
  const r = n[e];
  if (!r) return null;
  const s = [], i = [];
  for (const c of r.labels) {
    const d = r.dims[c];
    if (!d) return null;
    if (d.kind === "axis") {
      s.push(d.capacity ?? d.entries.length);
      const _ = d.entries.indexOf(t[c]);
      if (_ < 0) return null;
      i.push(_);
    } else {
      const _ = d.values;
      s.push(_.length);
      const T = t[c] ?? _[0], w = _.indexOf(T);
      i.push(w < 0 ? 0 : w);
    }
  }
  const a = new Array(s.length);
  a[s.length - 1] = 1;
  for (let c = s.length - 2; c >= 0; c--) a[c] = a[c + 1] * s[c + 1];
  let o = 0;
  for (let c = 0; c < i.length; c++) o += i[c] * a[c];
  return { prefix: e, version: r.version, address: o, serialized: `${e}:${r.version}:${o}` };
}
function Sn(n, e) {
  const t = e.split(":"), [r, s, i] = t.length === 4 ? [t[1], t[2], t[3]] : [t[0], t[1], t[2]], a = n[r];
  if (!a) return null;
  let o = parseInt(i);
  if (isNaN(o)) return null;
  const c = [], d = [];
  for (const w of a.labels) {
    const q = a.dims[w];
    q && (q.kind === "axis" ? c.push(q.capacity ?? q.entries.length) : c.push(q.values.length), d.push({ label: w, dim: q }));
  }
  const _ = new Array(c.length);
  _[c.length - 1] = 1;
  for (let w = c.length - 2; w >= 0; w--) _[w] = _[w + 1] * c[w + 1];
  const T = {};
  for (let w = 0; w < d.length; w++) {
    const q = Math.floor(o / _[w]);
    o %= _[w];
    const { label: He, dim: le } = d[w];
    T[He] = le.kind === "axis" ? le.entries[q] ?? `(${q})` : le.values[q] ?? q;
  }
  return { prefix: r, version: s, values: T };
}
function In(n, e) {
  const t = {};
  for (const [r, s] of Object.entries(e)) {
    const i = n[r];
    if (!i) continue;
    const a = { ...s };
    for (const c of i.labels) {
      const d = i.dims[c];
      (d == null ? void 0 : d.kind) === "prefix_ref" && !(c in a) && (a[c] = d.values[0]);
    }
    const o = wn(n, r, a);
    o && (t[r] = o.serialized);
  }
  return t;
}
function An(n, e) {
  const t = {};
  for (const [r, s] of Object.entries(e)) {
    const i = Sn(n, s);
    i && (t[r] = { prefix: i.prefix, values: i.values });
  }
  return t;
}
const On = {
  service: { version: "v1", labels: ["env", "region", "svc_name", "namespace"], dims: { env: { kind: "axis", entries: ["dev", "stage", "prod", "test", "local"], capacity: 32 }, region: { kind: "axis", entries: ["asia", "usa"], capacity: 32 }, svc_name: { kind: "axis", entries: ["shopping-web", "shopping-backend", "auth", "payment", "gateway"], capacity: 32 }, namespace: { kind: "axis", entries: ["shop", "cms"], capacity: 32 } } },
  permission: { version: "v4", labels: ["perm_svc", "role"], dims: { perm_svc: { kind: "prefix_ref", values: [65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, role: { kind: "axis", entries: ["admin", "developer", "operator", "viewer", "readonly", "customer", "auditor"], capacity: 32 } } },
  event: { version: "v4", labels: ["evt_svc", "event_name", "initiator"], dims: { evt_svc: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 65536, 65568, 65600, 65632, 65664] }, event_name: { kind: "axis", entries: ["user.login", "user.logout", "order.created", "order.paid", "payment.failed", "session.expired", "config.changed", "payment.cancel_requested", "payment.cancel_approved", "payment.refunded"], capacity: 64 }, initiator: { kind: "axis", entries: ["web", "mobile"], capacity: 32 } } },
  rbac: { version: "v1", labels: ["role", "action", "resource"], dims: { role: { kind: "axis", entries: ["admin", "editor", "viewer"], capacity: 32 }, action: { kind: "axis", entries: ["read", "write", "delete", "admin"], capacity: 32 }, resource: { kind: "axis", entries: ["dashboard", "reports", "settings", "users"], capacity: 32 } } },
  content: { version: "v1", labels: ["tag", "category", "status", "locale", "channel"], dims: { tag: { kind: "axis", entries: ["frontend", "backend", "devops", "ai", "database"], capacity: 32 }, category: { kind: "axis", entries: ["tech", "design", "product", "culture"], capacity: 32 }, status: { kind: "axis", entries: ["draft", "published", "archived"], capacity: 32 }, locale: { kind: "axis", entries: ["ko", "en", "ja"], capacity: 32 }, channel: { kind: "axis", entries: ["web", "mobile"], capacity: 32 } } },
  tracking: { version: "v2", labels: ["trackAction", "page", "userType"], dims: { trackAction: { kind: "axis", entries: ["click", "view", "scroll", "submit", "navigate", "add_to_cart", "purchase", "close"], capacity: 32 }, page: { kind: "axis", entries: ["home", "product_list", "product_detail", "cart", "checkout", "order_complete", "mypage", "login"], capacity: 32 }, userType: { kind: "axis", entries: ["guest", "member", "premium"], capacity: 32 } } },
  relational: { version: "v2", labels: ["subjectKind", "predicate", "objectKind"], dims: { subjectKind: { kind: "axis", entries: ["_", "user", "role", "group", "service", "engine"], capacity: 32 }, predicate: { kind: "axis", entries: ["_", "has", "can_access", "belongs_to", "has_capability", "evaluated", "migrated_to"], capacity: 32 }, objectKind: { kind: "axis", entries: ["_", "role", "permission", "group", "resource", "queue", "metric_store", "constraint", "prefix_version"], capacity: 32 } } },
  page_view: { version: "v2", labels: ["svc_ref", "page", "locale", "userType"], dims: { svc_ref: { kind: "prefix_ref", values: [65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, page: { kind: "axis", entries: ["home", "product_list", "product_detail", "cart", "checkout", "order_complete", "mypage", "login"], capacity: 32 }, locale: { kind: "axis", entries: ["ko", "en", "ja"], capacity: 32 }, userType: { kind: "axis", entries: ["guest", "member", "premium"], capacity: 32 } } },
  endpoint: { version: "v1", labels: ["svc_ref", "resource_type", "http_method", "api_version"], dims: { svc_ref: { kind: "prefix_ref", values: [65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, resource_type: { kind: "axis", entries: ["api", "page", "webhook", "grpc"], capacity: 32 }, http_method: { kind: "axis", entries: ["GET", "POST", "PUT", "DELETE", "PATCH"], capacity: 32 }, api_version: { kind: "axis", entries: ["v1", "v2"], capacity: 32 } } },
  flow_point: { version: "v2", labels: ["svc_ref", "flow_name", "flow_step", "flow_variant"], dims: { svc_ref: { kind: "prefix_ref", values: [65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, flow_name: { kind: "axis", entries: ["checkout", "signup", "order_cancel", "refund", "login", "browse", "cart_manage", "payment"], capacity: 64 }, flow_step: { kind: "axis", entries: ["entry", "processing", "branch", "success", "failure", "timeout", "payment", "complete", "exit"], capacity: 32 }, flow_variant: { kind: "axis", entries: ["default", "retry", "fallback", "manual"], capacity: 32 } } },
  engine_event: { version: "v1", labels: ["svc_ref", "constraint_op", "verdict_result"], dims: { svc_ref: { kind: "prefix_ref", values: [65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, constraint_op: { kind: "axis", entries: ["eq", "neq", "exists", "gt", "lt", "contains", "masked"], capacity: 32 }, verdict_result: { kind: "axis", entries: ["pass", "fail", "warn", "degraded", "unknown", "skipped"], capacity: 32 } } },
  schema_event: { version: "v1", labels: ["svc_ref", "migration_pattern", "deploy_action"], dims: { svc_ref: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 32768, 32800, 32832, 32864, 32896, 65536, 65568, 65600, 65632, 65664] }, migration_pattern: { kind: "axis", entries: ["identity", "reorder", "append_dim", "remove_dim", "composite", "unknown"], capacity: 32 }, deploy_action: { kind: "axis", entries: ["deploy", "rollback", "scale_up", "scale_down", "restart", "canary_start", "canary_promote", "migrate"], capacity: 32 } } },
  schema_validation: { version: "v1", labels: ["svc_ref", "validation_layer", "constraint_rule", "verdict_result"], dims: { svc_ref: { kind: "prefix_ref", values: [65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, validation_layer: { kind: "axis", entries: ["vocabulary", "structural", "constraint"], capacity: 8 }, constraint_rule: { kind: "axis", entries: ["required", "maxCount", "minCount", "requiredIf", "exclusive", "type", "multi", "unknownAxis"], capacity: 32 }, verdict_result: { kind: "axis", entries: ["pass", "fail", "warn", "degraded", "unknown", "skipped"], capacity: 32 } } },
  pipeline_point: { version: "v1", labels: ["svc_ref", "pipeline_phase", "validation_mode", "verdict_result", "temporal_strategy"], dims: { svc_ref: { kind: "prefix_ref", values: [65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, pipeline_phase: { kind: "axis", entries: ["ingest", "reconstruct", "verdict", "aggregate", "propagate"], capacity: 32 }, validation_mode: { kind: "axis", entries: ["strict", "warn", "off"], capacity: 32 }, verdict_result: { kind: "axis", entries: ["pass", "fail", "warn", "degraded", "unknown", "skipped"], capacity: 32 }, temporal_strategy: { kind: "axis", entries: ["span_local", "global"], capacity: 32 } } },
  data_policy: { version: "v1", labels: ["svc_ref", "mask_mode"], dims: { svc_ref: { kind: "prefix_ref", values: [65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, mask_mode: { kind: "axis", entries: ["raw", "mask", "drop", "hash"], capacity: 32 } } },
  deploy_event: { version: "v1", labels: ["svc_ref", "deploy_action"], dims: { svc_ref: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 32768, 32800, 32832, 32864, 32896, 65536, 65568, 65600, 65632, 65664] }, deploy_action: { kind: "axis", entries: ["deploy", "rollback", "scale_up", "scale_down", "restart", "canary_start", "canary_promote"], capacity: 32 } } },
  health_event: { version: "v1", labels: ["svc_ref", "health_status"], dims: { svc_ref: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 32768, 32800, 32832, 32864, 32896, 65536, 65568, 65600, 65632, 65664] }, health_status: { kind: "axis", entries: ["healthy", "degraded", "unhealthy", "maintenance"], capacity: 32 } } },
  cart_event: { version: "v1", labels: ["action"], dims: { action: { kind: "axis", entries: ["add", "remove", "checkout"], capacity: 32 } } },
  auth_event: { version: "v1", labels: ["action"], dims: { action: { kind: "axis", entries: ["login", "logout", "token_refresh"], capacity: 32 } } },
  order_event: { version: "v1", labels: ["service_ctx", "action"], dims: { service_ctx: { kind: "prefix_ref", values: [65536, 65568, 65600, 65632, 65664] }, action: { kind: "axis", entries: ["create", "cancel", "refund", "complete"], capacity: 32 } } },
  build_event: { version: "v2", labels: ["qa_pkg", "qa_module", "build_result"], dims: { qa_pkg: { kind: "axis", entries: ["spec-core", "cli", "sdk", "demo-snapshot", "weighted-index", "bit-index", "permission-engine", "index-meta", "platform-demo", "ingest-server", "registry-service", "e2e"], capacity: 32 }, qa_module: { kind: "axis", entries: ["shared", "schema", "export-surface", "spec", "loader", "codegen", "dkg", "dkg-skills", "convergence", "propagation", "store", "visualization", "shopping-flow", "event-pipeline", "iframe-integration", "scenario-selector", "shop-ingest-integration", "anonymous-browse", "cart-abandon", "multi-product-purchase", "_all"], capacity: 32 }, build_result: { kind: "axis", entries: ["success", "failure", "type-error", "skipped"], capacity: 8 } } },
  test_event: { version: "v2", labels: ["qa_pkg", "qa_module", "test_result"], dims: { qa_pkg: { kind: "axis", entries: ["spec-core", "cli", "sdk", "demo-snapshot", "weighted-index", "bit-index", "permission-engine", "index-meta", "platform-demo", "ingest-server", "registry-service", "e2e"], capacity: 32 }, qa_module: { kind: "axis", entries: ["shared", "schema", "export-surface", "spec", "loader", "codegen", "dkg", "dkg-skills", "convergence", "propagation", "store", "visualization", "shopping-flow", "event-pipeline", "iframe-integration", "scenario-selector", "shop-ingest-integration", "anonymous-browse", "cart-abandon", "multi-product-purchase", "_all"], capacity: 32 }, test_result: { kind: "axis", entries: ["passed", "failed", "error", "skipped", "timeout"], capacity: 8 } } },
  dkg_event: { version: "v1", labels: ["dkg_op", "dkg_target_kind"], dims: { dkg_op: { kind: "axis", entries: ["claim", "release", "decide", "observe", "resolve", "link", "refresh", "self-check", "converge", "trace", "promote"], capacity: 16 }, dkg_target_kind: { kind: "axis", entries: ["axis", "prefix", "domain", "dsl-bundle", "decision", "observation", "constraint", "skill", "intent-link", "system"], capacity: 16 } } },
  dkg_decision_event: { version: "v1", labels: ["decision_type", "dkg_target_kind", "node_source"], dims: { decision_type: { kind: "axis", entries: ["capacity", "new-axis", "new-prefix", "dim-add", "merge", "deprecate", "separation"], capacity: 16 }, dkg_target_kind: { kind: "axis", entries: ["axis", "prefix", "domain", "dsl-bundle", "decision", "observation", "constraint", "skill", "intent-link", "system"], capacity: 16 }, node_source: { kind: "axis", entries: ["bootstrap", "manual", "auto"], capacity: 8 } } },
  dkg_observation_event: { version: "v1", labels: ["obs_source", "dkg_target_kind", "lifecycle_state"], dims: { obs_source: { kind: "axis", entries: ["manual", "metric", "runtime", "review"], capacity: 8 }, dkg_target_kind: { kind: "axis", entries: ["axis", "prefix", "domain", "dsl-bundle", "decision", "observation", "constraint", "skill", "intent-link", "system"], capacity: 16 }, lifecycle_state: { kind: "axis", entries: ["draft", "active", "deprecated", "archived", "superseded", "reversed"], capacity: 16 } } },
  skill_execution: { version: "v1", labels: ["skill_id", "skill_category", "skill_outcome"], dims: { skill_id: { kind: "axis", entries: ["skill-trace", "skill-explore-service", "skill-explore-prefix", "skill-explore-dsl", "skill-system-overview", "skill-record-decision", "skill-record-observation", "skill-claim", "skill-release", "skill-lifecycle-transition", "skill-checkout-flow-verify", "skill-commerce-skew-audit", "skill-observation-coverage", "skill-infra-impact-verify", "skill-pipeline-phase-verify", "skill-event-action-check", "skill-svc-binding-check", "skill-safe-entry-add", "skill-decision-scaffold", "skill-analyze-impact", "skill-infer-migrator", "skill-domain-health", "skill-pattern-analysis", "skill-schema-health-audit", "skill-entry-add-chain", "skill-system-health-chain", "skill-converge-chain", "skill-self-check-analyze", "skill-cli-coverage", "skill-promote-scan", "skill-spec-manage", "skill-registry-publish"], capacity: 64 }, skill_category: { kind: "axis", entries: ["read", "write", "analysis", "chain"], capacity: 8 }, skill_outcome: { kind: "axis", entries: ["ok", "warning", "error", "blocked", "skipped"], capacity: 8 } } },
  cli_event: { version: "v1", labels: ["cli_intent", "cli_domain", "cli_subject"], dims: { cli_intent: { kind: "axis", entries: ["query", "analyze", "mutate", "publish", "lifecycle", "init", "backup"], capacity: 16 }, cli_domain: { kind: "axis", entries: ["dkg-graph", "dkg-skill", "convergence", "spec", "coordinate", "registry", "catalog", "self-ref", "system"], capacity: 16 }, cli_subject: { kind: "axis", entries: ["axis", "prefix", "domain", "dsl-bundle", "decision", "observation", "constraint", "skill", "intent-link", "system", "version", "spec", "schema", "catalog"], capacity: 32 } } },
  contract_check: { version: "v1", labels: ["qa_pkg", "api_surface", "test_result"], dims: { qa_pkg: { kind: "axis", entries: ["spec-core", "cli", "sdk", "demo-snapshot", "weighted-index", "bit-index", "permission-engine", "index-meta", "platform-demo", "ingest-server", "registry-service", "e2e", "core", "engine", "store", "gate-service", "query-service", "decode-service", "registry-server", "registry-client", "apm", "browser-sdk", "event-catalog", "pino", "viz-3d", "viz-web", "demo-tests", "weighted-wasm"], capacity: 64 }, api_surface: { kind: "axis", entries: ["encode-decode", "stride-calc", "bitmask-ops", "dim-extract", "perm-grant", "protocol-codec", "state-lifecycle", "query-resolve", "schema-validate", "convergence-analysis", "dkg-graph", "integration"], capacity: 16 }, test_result: { kind: "axis", entries: ["passed", "failed", "error", "skipped", "timeout"], capacity: 8 } } },
  pattern_match: { version: "v1", labels: ["svc_ref", "identification_mode", "behavior_pattern", "pattern_confidence"], dims: { svc_ref: { kind: "prefix_ref", values: [65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, identification_mode: { kind: "axis", entries: ["anonymous", "identified", "pseudonymized", "service"], capacity: 8 }, behavior_pattern: { kind: "axis", entries: ["purchase_complete", "browse_only", "cart_abandon", "checkout_fail", "error_recovery", "return_visit", "anonymous_browse", "anonymous_cart", "api_integration", "bot_crawl", "health_check", "unclassified"], capacity: 32 }, pattern_confidence: { kind: "axis", entries: ["exact", "high", "medium", "low", "unknown"], capacity: 8 } } },
  pattern_anomaly: { version: "v2", labels: ["svc_ref", "anomaly_kind", "behavior_pattern", "anomaly_severity"], dims: { svc_ref: { kind: "prefix_ref", values: [65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, anomaly_kind: { kind: "axis", entries: ["unclassified", "ratio_shift", "volume_spike", "new_sequence", "abnormal_speed", "abnormal_duration"], capacity: 16 }, behavior_pattern: { kind: "axis", entries: ["purchase_complete", "browse_only", "cart_abandon", "checkout_fail", "error_recovery", "return_visit", "anonymous_browse", "anonymous_cart", "api_integration", "bot_crawl", "health_check", "unclassified"], capacity: 32 }, anomaly_severity: { kind: "axis", entries: ["info", "warning", "critical"], capacity: 8 } } },
  version_point: { version: "v1", labels: ["svc_ref", "version_lifecycle"], dims: { svc_ref: { kind: "prefix_ref", values: [65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, version_lifecycle: { kind: "axis", entries: ["draft", "locked", "released", "active", "deprecated"], capacity: 8 } } },
  gate_point: { version: "v1", labels: ["svc_ref", "address_state"], dims: { svc_ref: { kind: "prefix_ref", values: [65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, address_state: { kind: "axis", entries: ["active", "reserved", "inactive", "open"], capacity: 8 } } },
  observation_event: { version: "v1", labels: ["observation_intent", "dkg_target_kind"], dims: { observation_intent: { kind: "axis", entries: ["action_needed", "monitoring", "completed"], capacity: 8 }, dkg_target_kind: { kind: "axis", entries: ["axis", "prefix", "domain", "dsl-bundle", "decision", "observation", "constraint", "skill", "intent-link", "system"], capacity: 16 } } },
  spec_event: { version: "v1", labels: ["spec_type", "lifecycle_state"], dims: { spec_type: { kind: "axis", entries: ["req", "feat", "uc", "evt", "ls", "adr"], capacity: 16 }, lifecycle_state: { kind: "axis", entries: ["draft", "active", "deprecated", "archived", "superseded", "reversed"], capacity: 16 } } },
  edge_activity: { version: "v1", labels: ["edge_type", "dkg_target_kind"], dims: { edge_type: { kind: "axis", entries: ["satisfies", "implements", "tests", "traces-to", "depends-on", "composes", "references", "governs", "justifies", "constrains", "contains", "bridges", "consumes", "binds", "observes", "prompts", "evolves-from", "supersedes"], capacity: 32 }, dkg_target_kind: { kind: "axis", entries: ["axis", "prefix", "domain", "dsl-bundle", "decision", "observation", "constraint", "skill", "intent-link", "system"], capacity: 16 } } },
  execution_context: { version: "v1", labels: ["svc_ref", "execution_mode"], dims: { svc_ref: { kind: "prefix_ref", values: [65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, execution_mode: { kind: "axis", entries: ["live", "test", "synthetic", "replay"], capacity: 8 } } },
  ingest_record: { version: "v1", labels: ["svc_ref", "record_type"], dims: { svc_ref: { kind: "prefix_ref", values: [65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, record_type: { kind: "axis", entries: ["log", "span", "metric"], capacity: 8 } } },
  event_classification: { version: "v1", labels: ["svc_ref", "event_category", "event_lifecycle_stage"], dims: { svc_ref: { kind: "prefix_ref", values: [65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, event_category: { kind: "axis", entries: ["user_action", "system_action", "network_action", "data_action", "agent_action", "sdk_action", "error", "state_change"], capacity: 16 }, event_lifecycle_stage: { kind: "axis", entries: ["interaction", "request", "processing", "result", "side_effect", "completion"], capacity: 16 } } },
  metric_point: { version: "v1", labels: ["svc_ref", "metric_type", "record_type"], dims: { svc_ref: { kind: "prefix_ref", values: [65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, metric_type: { kind: "axis", entries: ["counter", "gauge", "histogram", "summary"], capacity: 8 }, record_type: { kind: "axis", entries: ["log", "span", "metric"], capacity: 8 } } }
};
export {
  On as BROWSER_CATALOG,
  vn as BeaconTransport,
  xn as QaMonitor,
  qn as buildEnvToCatalogEnv,
  et as catalogEnvToBuildEnv,
  En as createQaMonitor,
  Sn as decode,
  An as decodeContext,
  wn as encode,
  de as newLogId,
  Xt as newQaSessionId,
  Yt as newSpanId,
  Be as newTraceId,
  Qt as newTransmissionId,
  Cn as toServiceDims,
  Qe as toTransmissionBuild,
  Je as toTransmissionSource,
  In as track
};
//# sourceMappingURL=qa-browser-sdk.js.map
