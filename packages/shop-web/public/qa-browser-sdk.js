var rt = Object.defineProperty;
var nt = (r, e, t) => e in r ? rt(r, e, { enumerable: !0, configurable: !0, writable: !0, value: t }) : r[e] = t;
var w = (r, e, t) => nt(r, typeof e != "symbol" ? e + "" : e, t);
function Ve(r) {
  return {
    env: r.env,
    region: r.region,
    svc_name: r.name,
    namespace: r.namespace
  };
}
function it(r, e, t) {
  return {
    service_name: `${r.namespace}/${r.name}`,
    sdk_name: e,
    sdk_version: t
  };
}
function at(r) {
  return {
    env: ct(r.env),
    ...r.build != null ? { build_ref: r.build } : {},
    ...r.releaseVersion != null ? { release_version: r.releaseVersion } : {}
  };
}
const st = {
  prod: "production",
  stage: "staging"
}, ot = {
  production: "prod",
  staging: "stage"
};
function ct(r) {
  return st[r] ?? r;
}
function Ur(r) {
  return ot[r] ?? r;
}
var b;
(function(r) {
  r.assertEqual = (i) => {
  };
  function e(i) {
  }
  r.assertIs = e;
  function t(i) {
    throw new Error();
  }
  r.assertNever = t, r.arrayToEnum = (i) => {
    const a = {};
    for (const s of i)
      a[s] = s;
    return a;
  }, r.getValidEnumValues = (i) => {
    const a = r.objectKeys(i).filter((o) => typeof i[i[o]] != "number"), s = {};
    for (const o of a)
      s[o] = i[o];
    return r.objectValues(s);
  }, r.objectValues = (i) => r.objectKeys(i).map(function(a) {
    return i[a];
  }), r.objectKeys = typeof Object.keys == "function" ? (i) => Object.keys(i) : (i) => {
    const a = [];
    for (const s in i)
      Object.prototype.hasOwnProperty.call(i, s) && a.push(s);
    return a;
  }, r.find = (i, a) => {
    for (const s of i)
      if (a(s))
        return s;
  }, r.isInteger = typeof Number.isInteger == "function" ? (i) => Number.isInteger(i) : (i) => typeof i == "number" && Number.isFinite(i) && Math.floor(i) === i;
  function n(i, a = " | ") {
    return i.map((s) => typeof s == "string" ? `'${s}'` : s).join(a);
  }
  r.joinValues = n, r.jsonStringifyReplacer = (i, a) => typeof a == "bigint" ? a.toString() : a;
})(b || (b = {}));
var Ie;
(function(r) {
  r.mergeShapes = (e, t) => ({
    ...e,
    ...t
    // second overwrites first
  });
})(Ie || (Ie = {}));
const f = b.arrayToEnum([
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
]), M = (r) => {
  switch (typeof r) {
    case "undefined":
      return f.undefined;
    case "string":
      return f.string;
    case "number":
      return Number.isNaN(r) ? f.nan : f.number;
    case "boolean":
      return f.boolean;
    case "function":
      return f.function;
    case "bigint":
      return f.bigint;
    case "symbol":
      return f.symbol;
    case "object":
      return Array.isArray(r) ? f.array : r === null ? f.null : r.then && typeof r.then == "function" && r.catch && typeof r.catch == "function" ? f.promise : typeof Map < "u" && r instanceof Map ? f.map : typeof Set < "u" && r instanceof Set ? f.set : typeof Date < "u" && r instanceof Date ? f.date : f.object;
    default:
      return f.unknown;
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
class $ extends Error {
  get errors() {
    return this.issues;
  }
  constructor(e) {
    super(), this.issues = [], this.addIssue = (n) => {
      this.issues = [...this.issues, n];
    }, this.addIssues = (n = []) => {
      this.issues = [...this.issues, ...n];
    };
    const t = new.target.prototype;
    Object.setPrototypeOf ? Object.setPrototypeOf(this, t) : this.__proto__ = t, this.name = "ZodError", this.issues = e;
  }
  format(e) {
    const t = e || function(a) {
      return a.message;
    }, n = { _errors: [] }, i = (a) => {
      for (const s of a.issues)
        if (s.code === "invalid_union")
          s.unionErrors.map(i);
        else if (s.code === "invalid_return_type")
          i(s.returnTypeError);
        else if (s.code === "invalid_arguments")
          i(s.argumentsError);
        else if (s.path.length === 0)
          n._errors.push(t(s));
        else {
          let o = n, c = 0;
          for (; c < s.path.length; ) {
            const d = s.path[c];
            c === s.path.length - 1 ? (o[d] = o[d] || { _errors: [] }, o[d]._errors.push(t(s))) : o[d] = o[d] || { _errors: [] }, o = o[d], c++;
          }
        }
    };
    return i(this), n;
  }
  static assert(e) {
    if (!(e instanceof $))
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
    const t = {}, n = [];
    for (const i of this.issues)
      if (i.path.length > 0) {
        const a = i.path[0];
        t[a] = t[a] || [], t[a].push(e(i));
      } else
        n.push(e(i));
    return { formErrors: n, fieldErrors: t };
  }
  get formErrors() {
    return this.flatten();
  }
}
$.create = (r) => new $(r);
const he = (r, e) => {
  let t;
  switch (r.code) {
    case l.invalid_type:
      r.received === f.undefined ? t = "Required" : t = `Expected ${r.expected}, received ${r.received}`;
      break;
    case l.invalid_literal:
      t = `Invalid literal value, expected ${JSON.stringify(r.expected, b.jsonStringifyReplacer)}`;
      break;
    case l.unrecognized_keys:
      t = `Unrecognized key(s) in object: ${b.joinValues(r.keys, ", ")}`;
      break;
    case l.invalid_union:
      t = "Invalid input";
      break;
    case l.invalid_union_discriminator:
      t = `Invalid discriminator value. Expected ${b.joinValues(r.options)}`;
      break;
    case l.invalid_enum_value:
      t = `Invalid enum value. Expected ${b.joinValues(r.options)}, received '${r.received}'`;
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
      typeof r.validation == "object" ? "includes" in r.validation ? (t = `Invalid input: must include "${r.validation.includes}"`, typeof r.validation.position == "number" && (t = `${t} at one or more positions greater than or equal to ${r.validation.position}`)) : "startsWith" in r.validation ? t = `Invalid input: must start with "${r.validation.startsWith}"` : "endsWith" in r.validation ? t = `Invalid input: must end with "${r.validation.endsWith}"` : b.assertNever(r.validation) : r.validation !== "regex" ? t = `Invalid ${r.validation}` : t = "Invalid";
      break;
    case l.too_small:
      r.type === "array" ? t = `Array must contain ${r.exact ? "exactly" : r.inclusive ? "at least" : "more than"} ${r.minimum} element(s)` : r.type === "string" ? t = `String must contain ${r.exact ? "exactly" : r.inclusive ? "at least" : "over"} ${r.minimum} character(s)` : r.type === "number" ? t = `Number must be ${r.exact ? "exactly equal to " : r.inclusive ? "greater than or equal to " : "greater than "}${r.minimum}` : r.type === "bigint" ? t = `Number must be ${r.exact ? "exactly equal to " : r.inclusive ? "greater than or equal to " : "greater than "}${r.minimum}` : r.type === "date" ? t = `Date must be ${r.exact ? "exactly equal to " : r.inclusive ? "greater than or equal to " : "greater than "}${new Date(Number(r.minimum))}` : t = "Invalid input";
      break;
    case l.too_big:
      r.type === "array" ? t = `Array must contain ${r.exact ? "exactly" : r.inclusive ? "at most" : "less than"} ${r.maximum} element(s)` : r.type === "string" ? t = `String must contain ${r.exact ? "exactly" : r.inclusive ? "at most" : "under"} ${r.maximum} character(s)` : r.type === "number" ? t = `Number must be ${r.exact ? "exactly" : r.inclusive ? "less than or equal to" : "less than"} ${r.maximum}` : r.type === "bigint" ? t = `BigInt must be ${r.exact ? "exactly" : r.inclusive ? "less than or equal to" : "less than"} ${r.maximum}` : r.type === "date" ? t = `Date must be ${r.exact ? "exactly" : r.inclusive ? "smaller than or equal to" : "smaller than"} ${new Date(Number(r.maximum))}` : t = "Invalid input";
      break;
    case l.custom:
      t = "Invalid input";
      break;
    case l.invalid_intersection_types:
      t = "Intersection results could not be merged";
      break;
    case l.not_multiple_of:
      t = `Number must be a multiple of ${r.multipleOf}`;
      break;
    case l.not_finite:
      t = "Number must be finite";
      break;
    default:
      t = e.defaultError, b.assertNever(r);
  }
  return { message: t };
};
let lt = he;
function dt() {
  return lt;
}
const ut = (r) => {
  const { data: e, path: t, errorMaps: n, issueData: i } = r, a = [...t, ...i.path || []], s = {
    ...i,
    path: a
  };
  if (i.message !== void 0)
    return {
      ...i,
      path: a,
      message: i.message
    };
  let o = "";
  const c = n.filter((d) => !!d).slice().reverse();
  for (const d of c)
    o = d(s, { data: e, defaultError: o }).message;
  return {
    ...i,
    path: a,
    message: o
  };
};
function p(r, e) {
  const t = dt(), n = ut({
    issueData: e,
    data: r.data,
    path: r.path,
    errorMaps: [
      r.common.contextualErrorMap,
      // contextual error map is first priority
      r.schemaErrorMap,
      // then schema-bound map if available
      t,
      // then global override map
      t === he ? void 0 : he
      // then global default map
    ].filter((i) => !!i)
  });
  r.common.issues.push(n);
}
class C {
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
    const n = [];
    for (const i of t) {
      if (i.status === "aborted")
        return y;
      i.status === "dirty" && e.dirty(), n.push(i.value);
    }
    return { status: e.value, value: n };
  }
  static async mergeObjectAsync(e, t) {
    const n = [];
    for (const i of t) {
      const a = await i.key, s = await i.value;
      n.push({
        key: a,
        value: s
      });
    }
    return C.mergeObjectSync(e, n);
  }
  static mergeObjectSync(e, t) {
    const n = {};
    for (const i of t) {
      const { key: a, value: s } = i;
      if (a.status === "aborted" || s.status === "aborted")
        return y;
      a.status === "dirty" && e.dirty(), s.status === "dirty" && e.dirty(), a.value !== "__proto__" && (typeof s.value < "u" || i.alwaysSet) && (n[a.value] = s.value);
    }
    return { status: e.value, value: n };
  }
}
const y = Object.freeze({
  status: "aborted"
}), K = (r) => ({ status: "dirty", value: r }), A = (r) => ({ status: "valid", value: r }), Ce = (r) => r.status === "aborted", Ae = (r) => r.status === "dirty", U = (r) => r.status === "valid", ae = (r) => typeof Promise < "u" && r instanceof Promise;
var _;
(function(r) {
  r.errToObj = (e) => typeof e == "string" ? { message: e } : e || {}, r.toString = (e) => typeof e == "string" ? e : e == null ? void 0 : e.message;
})(_ || (_ = {}));
class R {
  constructor(e, t, n, i) {
    this._cachedPath = [], this.parent = e, this.data = t, this._path = n, this._key = i;
  }
  get path() {
    return this._cachedPath.length || (Array.isArray(this._key) ? this._cachedPath.push(...this._path, ...this._key) : this._cachedPath.push(...this._path, this._key)), this._cachedPath;
  }
}
const qe = (r, e) => {
  if (U(e))
    return { success: !0, data: e.value };
  if (!r.common.issues.length)
    throw new Error("Validation failed but no issues detected.");
  return {
    success: !1,
    get error() {
      if (this._error)
        return this._error;
      const t = new $(r.common.issues);
      return this._error = t, this._error;
    }
  };
};
function v(r) {
  if (!r)
    return {};
  const { errorMap: e, invalid_type_error: t, required_error: n, description: i } = r;
  if (e && (t || n))
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  return e ? { errorMap: e, description: i } : { errorMap: (s, o) => {
    const { message: c } = r;
    return s.code === "invalid_enum_value" ? { message: c ?? o.defaultError } : typeof o.data > "u" ? { message: c ?? n ?? o.defaultError } : s.code !== "invalid_type" ? { message: o.defaultError } : { message: c ?? t ?? o.defaultError };
  }, description: i };
}
class k {
  get description() {
    return this._def.description;
  }
  _getType(e) {
    return M(e.data);
  }
  _getOrReturnCtx(e, t) {
    return t || {
      common: e.parent.common,
      data: e.data,
      parsedType: M(e.data),
      schemaErrorMap: this._def.errorMap,
      path: e.path,
      parent: e.parent
    };
  }
  _processInputParams(e) {
    return {
      status: new C(),
      ctx: {
        common: e.parent.common,
        data: e.data,
        parsedType: M(e.data),
        schemaErrorMap: this._def.errorMap,
        path: e.path,
        parent: e.parent
      }
    };
  }
  _parseSync(e) {
    const t = this._parse(e);
    if (ae(t))
      throw new Error("Synchronous parse encountered promise.");
    return t;
  }
  _parseAsync(e) {
    const t = this._parse(e);
    return Promise.resolve(t);
  }
  parse(e, t) {
    const n = this.safeParse(e, t);
    if (n.success)
      return n.data;
    throw n.error;
  }
  safeParse(e, t) {
    const n = {
      common: {
        issues: [],
        async: (t == null ? void 0 : t.async) ?? !1,
        contextualErrorMap: t == null ? void 0 : t.errorMap
      },
      path: (t == null ? void 0 : t.path) || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data: e,
      parsedType: M(e)
    }, i = this._parseSync({ data: e, path: n.path, parent: n });
    return qe(n, i);
  }
  "~validate"(e) {
    var n, i;
    const t = {
      common: {
        issues: [],
        async: !!this["~standard"].async
      },
      path: [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data: e,
      parsedType: M(e)
    };
    if (!this["~standard"].async)
      try {
        const a = this._parseSync({ data: e, path: [], parent: t });
        return U(a) ? {
          value: a.value
        } : {
          issues: t.common.issues
        };
      } catch (a) {
        (i = (n = a == null ? void 0 : a.message) == null ? void 0 : n.toLowerCase()) != null && i.includes("encountered") && (this["~standard"].async = !0), t.common = {
          issues: [],
          async: !0
        };
      }
    return this._parseAsync({ data: e, path: [], parent: t }).then((a) => U(a) ? {
      value: a.value
    } : {
      issues: t.common.issues
    });
  }
  async parseAsync(e, t) {
    const n = await this.safeParseAsync(e, t);
    if (n.success)
      return n.data;
    throw n.error;
  }
  async safeParseAsync(e, t) {
    const n = {
      common: {
        issues: [],
        contextualErrorMap: t == null ? void 0 : t.errorMap,
        async: !0
      },
      path: (t == null ? void 0 : t.path) || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data: e,
      parsedType: M(e)
    }, i = this._parse({ data: e, path: n.path, parent: n }), a = await (ae(i) ? i : Promise.resolve(i));
    return qe(n, a);
  }
  refine(e, t) {
    const n = (i) => typeof t == "string" || typeof t > "u" ? { message: t } : typeof t == "function" ? t(i) : t;
    return this._refinement((i, a) => {
      const s = e(i), o = () => a.addIssue({
        code: l.custom,
        ...n(i)
      });
      return typeof Promise < "u" && s instanceof Promise ? s.then((c) => c ? !0 : (o(), !1)) : s ? !0 : (o(), !1);
    });
  }
  refinement(e, t) {
    return this._refinement((n, i) => e(n) ? !0 : (i.addIssue(typeof t == "function" ? t(n, i) : t), !1));
  }
  _refinement(e) {
    return new D({
      schema: this,
      typeName: g.ZodEffects,
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
    return P.create(this, this._def);
  }
  nullable() {
    return H.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return O.create(this);
  }
  promise() {
    return de.create(this, this._def);
  }
  or(e) {
    return oe.create([this, e], this._def);
  }
  and(e) {
    return ce.create(this, e, this._def);
  }
  transform(e) {
    return new D({
      ...v(this._def),
      schema: this,
      typeName: g.ZodEffects,
      effect: { type: "transform", transform: e }
    });
  }
  default(e) {
    const t = typeof e == "function" ? e : () => e;
    return new ve({
      ...v(this._def),
      innerType: this,
      defaultValue: t,
      typeName: g.ZodDefault
    });
  }
  brand() {
    return new jt({
      typeName: g.ZodBranded,
      type: this,
      ...v(this._def)
    });
  }
  catch(e) {
    const t = typeof e == "function" ? e : () => e;
    return new ke({
      ...v(this._def),
      innerType: this,
      catchValue: t,
      typeName: g.ZodCatch
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
    return xe.create(this, e);
  }
  readonly() {
    return be.create(this);
  }
  isOptional() {
    return this.safeParse(void 0).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
}
const pt = /^c[^\s-]{8,}$/i, ft = /^[0-9a-z]+$/, _t = /^[0-9A-HJKMNP-TV-Z]{26}$/i, ht = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i, mt = /^[a-z0-9_-]{21}$/i, gt = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/, yt = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/, vt = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i, kt = "^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$";
let fe;
const bt = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/, xt = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/, wt = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/, St = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/, Tt = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/, It = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/, Be = "((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))", Ct = new RegExp(`^${Be}$`);
function Ue(r) {
  let e = "[0-5]\\d";
  r.precision ? e = `${e}\\.\\d{${r.precision}}` : r.precision == null && (e = `${e}(\\.\\d+)?`);
  const t = r.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${e})${t}`;
}
function At(r) {
  return new RegExp(`^${Ue(r)}$`);
}
function qt(r) {
  let e = `${Be}T${Ue(r)}`;
  const t = [];
  return t.push(r.local ? "Z?" : "Z"), r.offset && t.push("([+-]\\d{2}:?\\d{2})"), e = `${e}(${t.join("|")})`, new RegExp(`^${e}$`);
}
function Et(r, e) {
  return !!((e === "v4" || !e) && bt.test(r) || (e === "v6" || !e) && wt.test(r));
}
function Ot(r, e) {
  if (!gt.test(r))
    return !1;
  try {
    const [t] = r.split(".");
    if (!t)
      return !1;
    const n = t.replace(/-/g, "+").replace(/_/g, "/").padEnd(t.length + (4 - t.length % 4) % 4, "="), i = JSON.parse(atob(n));
    return !(typeof i != "object" || i === null || "typ" in i && (i == null ? void 0 : i.typ) !== "JWT" || !i.alg || e && i.alg !== e);
  } catch {
    return !1;
  }
}
function Nt(r, e) {
  return !!((e === "v4" || !e) && xt.test(r) || (e === "v6" || !e) && St.test(r));
}
class Z extends k {
  _parse(e) {
    if (this._def.coerce && (e.data = String(e.data)), this._getType(e) !== f.string) {
      const a = this._getOrReturnCtx(e);
      return p(a, {
        code: l.invalid_type,
        expected: f.string,
        received: a.parsedType
      }), y;
    }
    const n = new C();
    let i;
    for (const a of this._def.checks)
      if (a.kind === "min")
        e.data.length < a.value && (i = this._getOrReturnCtx(e, i), p(i, {
          code: l.too_small,
          minimum: a.value,
          type: "string",
          inclusive: !0,
          exact: !1,
          message: a.message
        }), n.dirty());
      else if (a.kind === "max")
        e.data.length > a.value && (i = this._getOrReturnCtx(e, i), p(i, {
          code: l.too_big,
          maximum: a.value,
          type: "string",
          inclusive: !0,
          exact: !1,
          message: a.message
        }), n.dirty());
      else if (a.kind === "length") {
        const s = e.data.length > a.value, o = e.data.length < a.value;
        (s || o) && (i = this._getOrReturnCtx(e, i), s ? p(i, {
          code: l.too_big,
          maximum: a.value,
          type: "string",
          inclusive: !0,
          exact: !0,
          message: a.message
        }) : o && p(i, {
          code: l.too_small,
          minimum: a.value,
          type: "string",
          inclusive: !0,
          exact: !0,
          message: a.message
        }), n.dirty());
      } else if (a.kind === "email")
        vt.test(e.data) || (i = this._getOrReturnCtx(e, i), p(i, {
          validation: "email",
          code: l.invalid_string,
          message: a.message
        }), n.dirty());
      else if (a.kind === "emoji")
        fe || (fe = new RegExp(kt, "u")), fe.test(e.data) || (i = this._getOrReturnCtx(e, i), p(i, {
          validation: "emoji",
          code: l.invalid_string,
          message: a.message
        }), n.dirty());
      else if (a.kind === "uuid")
        ht.test(e.data) || (i = this._getOrReturnCtx(e, i), p(i, {
          validation: "uuid",
          code: l.invalid_string,
          message: a.message
        }), n.dirty());
      else if (a.kind === "nanoid")
        mt.test(e.data) || (i = this._getOrReturnCtx(e, i), p(i, {
          validation: "nanoid",
          code: l.invalid_string,
          message: a.message
        }), n.dirty());
      else if (a.kind === "cuid")
        pt.test(e.data) || (i = this._getOrReturnCtx(e, i), p(i, {
          validation: "cuid",
          code: l.invalid_string,
          message: a.message
        }), n.dirty());
      else if (a.kind === "cuid2")
        ft.test(e.data) || (i = this._getOrReturnCtx(e, i), p(i, {
          validation: "cuid2",
          code: l.invalid_string,
          message: a.message
        }), n.dirty());
      else if (a.kind === "ulid")
        _t.test(e.data) || (i = this._getOrReturnCtx(e, i), p(i, {
          validation: "ulid",
          code: l.invalid_string,
          message: a.message
        }), n.dirty());
      else if (a.kind === "url")
        try {
          new URL(e.data);
        } catch {
          i = this._getOrReturnCtx(e, i), p(i, {
            validation: "url",
            code: l.invalid_string,
            message: a.message
          }), n.dirty();
        }
      else a.kind === "regex" ? (a.regex.lastIndex = 0, a.regex.test(e.data) || (i = this._getOrReturnCtx(e, i), p(i, {
        validation: "regex",
        code: l.invalid_string,
        message: a.message
      }), n.dirty())) : a.kind === "trim" ? e.data = e.data.trim() : a.kind === "includes" ? e.data.includes(a.value, a.position) || (i = this._getOrReturnCtx(e, i), p(i, {
        code: l.invalid_string,
        validation: { includes: a.value, position: a.position },
        message: a.message
      }), n.dirty()) : a.kind === "toLowerCase" ? e.data = e.data.toLowerCase() : a.kind === "toUpperCase" ? e.data = e.data.toUpperCase() : a.kind === "startsWith" ? e.data.startsWith(a.value) || (i = this._getOrReturnCtx(e, i), p(i, {
        code: l.invalid_string,
        validation: { startsWith: a.value },
        message: a.message
      }), n.dirty()) : a.kind === "endsWith" ? e.data.endsWith(a.value) || (i = this._getOrReturnCtx(e, i), p(i, {
        code: l.invalid_string,
        validation: { endsWith: a.value },
        message: a.message
      }), n.dirty()) : a.kind === "datetime" ? qt(a).test(e.data) || (i = this._getOrReturnCtx(e, i), p(i, {
        code: l.invalid_string,
        validation: "datetime",
        message: a.message
      }), n.dirty()) : a.kind === "date" ? Ct.test(e.data) || (i = this._getOrReturnCtx(e, i), p(i, {
        code: l.invalid_string,
        validation: "date",
        message: a.message
      }), n.dirty()) : a.kind === "time" ? At(a).test(e.data) || (i = this._getOrReturnCtx(e, i), p(i, {
        code: l.invalid_string,
        validation: "time",
        message: a.message
      }), n.dirty()) : a.kind === "duration" ? yt.test(e.data) || (i = this._getOrReturnCtx(e, i), p(i, {
        validation: "duration",
        code: l.invalid_string,
        message: a.message
      }), n.dirty()) : a.kind === "ip" ? Et(e.data, a.version) || (i = this._getOrReturnCtx(e, i), p(i, {
        validation: "ip",
        code: l.invalid_string,
        message: a.message
      }), n.dirty()) : a.kind === "jwt" ? Ot(e.data, a.alg) || (i = this._getOrReturnCtx(e, i), p(i, {
        validation: "jwt",
        code: l.invalid_string,
        message: a.message
      }), n.dirty()) : a.kind === "cidr" ? Nt(e.data, a.version) || (i = this._getOrReturnCtx(e, i), p(i, {
        validation: "cidr",
        code: l.invalid_string,
        message: a.message
      }), n.dirty()) : a.kind === "base64" ? Tt.test(e.data) || (i = this._getOrReturnCtx(e, i), p(i, {
        validation: "base64",
        code: l.invalid_string,
        message: a.message
      }), n.dirty()) : a.kind === "base64url" ? It.test(e.data) || (i = this._getOrReturnCtx(e, i), p(i, {
        validation: "base64url",
        code: l.invalid_string,
        message: a.message
      }), n.dirty()) : b.assertNever(a);
    return { status: n.value, value: e.data };
  }
  _regex(e, t, n) {
    return this.refinement((i) => e.test(i), {
      validation: t,
      code: l.invalid_string,
      ..._.errToObj(n)
    });
  }
  _addCheck(e) {
    return new Z({
      ...this._def,
      checks: [...this._def.checks, e]
    });
  }
  email(e) {
    return this._addCheck({ kind: "email", ..._.errToObj(e) });
  }
  url(e) {
    return this._addCheck({ kind: "url", ..._.errToObj(e) });
  }
  emoji(e) {
    return this._addCheck({ kind: "emoji", ..._.errToObj(e) });
  }
  uuid(e) {
    return this._addCheck({ kind: "uuid", ..._.errToObj(e) });
  }
  nanoid(e) {
    return this._addCheck({ kind: "nanoid", ..._.errToObj(e) });
  }
  cuid(e) {
    return this._addCheck({ kind: "cuid", ..._.errToObj(e) });
  }
  cuid2(e) {
    return this._addCheck({ kind: "cuid2", ..._.errToObj(e) });
  }
  ulid(e) {
    return this._addCheck({ kind: "ulid", ..._.errToObj(e) });
  }
  base64(e) {
    return this._addCheck({ kind: "base64", ..._.errToObj(e) });
  }
  base64url(e) {
    return this._addCheck({
      kind: "base64url",
      ..._.errToObj(e)
    });
  }
  jwt(e) {
    return this._addCheck({ kind: "jwt", ..._.errToObj(e) });
  }
  ip(e) {
    return this._addCheck({ kind: "ip", ..._.errToObj(e) });
  }
  cidr(e) {
    return this._addCheck({ kind: "cidr", ..._.errToObj(e) });
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
      ..._.errToObj(e == null ? void 0 : e.message)
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
      ..._.errToObj(e == null ? void 0 : e.message)
    });
  }
  duration(e) {
    return this._addCheck({ kind: "duration", ..._.errToObj(e) });
  }
  regex(e, t) {
    return this._addCheck({
      kind: "regex",
      regex: e,
      ..._.errToObj(t)
    });
  }
  includes(e, t) {
    return this._addCheck({
      kind: "includes",
      value: e,
      position: t == null ? void 0 : t.position,
      ..._.errToObj(t == null ? void 0 : t.message)
    });
  }
  startsWith(e, t) {
    return this._addCheck({
      kind: "startsWith",
      value: e,
      ..._.errToObj(t)
    });
  }
  endsWith(e, t) {
    return this._addCheck({
      kind: "endsWith",
      value: e,
      ..._.errToObj(t)
    });
  }
  min(e, t) {
    return this._addCheck({
      kind: "min",
      value: e,
      ..._.errToObj(t)
    });
  }
  max(e, t) {
    return this._addCheck({
      kind: "max",
      value: e,
      ..._.errToObj(t)
    });
  }
  length(e, t) {
    return this._addCheck({
      kind: "length",
      value: e,
      ..._.errToObj(t)
    });
  }
  /**
   * Equivalent to `.min(1)`
   */
  nonempty(e) {
    return this.min(1, _.errToObj(e));
  }
  trim() {
    return new Z({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }]
    });
  }
  toLowerCase() {
    return new Z({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }]
    });
  }
  toUpperCase() {
    return new Z({
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
Z.create = (r) => new Z({
  checks: [],
  typeName: g.ZodString,
  coerce: (r == null ? void 0 : r.coerce) ?? !1,
  ...v(r)
});
function Rt(r, e) {
  const t = (r.toString().split(".")[1] || "").length, n = (e.toString().split(".")[1] || "").length, i = t > n ? t : n, a = Number.parseInt(r.toFixed(i).replace(".", "")), s = Number.parseInt(e.toFixed(i).replace(".", ""));
  return a % s / 10 ** i;
}
class F extends k {
  constructor() {
    super(...arguments), this.min = this.gte, this.max = this.lte, this.step = this.multipleOf;
  }
  _parse(e) {
    if (this._def.coerce && (e.data = Number(e.data)), this._getType(e) !== f.number) {
      const a = this._getOrReturnCtx(e);
      return p(a, {
        code: l.invalid_type,
        expected: f.number,
        received: a.parsedType
      }), y;
    }
    let n;
    const i = new C();
    for (const a of this._def.checks)
      a.kind === "int" ? b.isInteger(e.data) || (n = this._getOrReturnCtx(e, n), p(n, {
        code: l.invalid_type,
        expected: "integer",
        received: "float",
        message: a.message
      }), i.dirty()) : a.kind === "min" ? (a.inclusive ? e.data < a.value : e.data <= a.value) && (n = this._getOrReturnCtx(e, n), p(n, {
        code: l.too_small,
        minimum: a.value,
        type: "number",
        inclusive: a.inclusive,
        exact: !1,
        message: a.message
      }), i.dirty()) : a.kind === "max" ? (a.inclusive ? e.data > a.value : e.data >= a.value) && (n = this._getOrReturnCtx(e, n), p(n, {
        code: l.too_big,
        maximum: a.value,
        type: "number",
        inclusive: a.inclusive,
        exact: !1,
        message: a.message
      }), i.dirty()) : a.kind === "multipleOf" ? Rt(e.data, a.value) !== 0 && (n = this._getOrReturnCtx(e, n), p(n, {
        code: l.not_multiple_of,
        multipleOf: a.value,
        message: a.message
      }), i.dirty()) : a.kind === "finite" ? Number.isFinite(e.data) || (n = this._getOrReturnCtx(e, n), p(n, {
        code: l.not_finite,
        message: a.message
      }), i.dirty()) : b.assertNever(a);
    return { status: i.value, value: e.data };
  }
  gte(e, t) {
    return this.setLimit("min", e, !0, _.toString(t));
  }
  gt(e, t) {
    return this.setLimit("min", e, !1, _.toString(t));
  }
  lte(e, t) {
    return this.setLimit("max", e, !0, _.toString(t));
  }
  lt(e, t) {
    return this.setLimit("max", e, !1, _.toString(t));
  }
  setLimit(e, t, n, i) {
    return new F({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind: e,
          value: t,
          inclusive: n,
          message: _.toString(i)
        }
      ]
    });
  }
  _addCheck(e) {
    return new F({
      ...this._def,
      checks: [...this._def.checks, e]
    });
  }
  int(e) {
    return this._addCheck({
      kind: "int",
      message: _.toString(e)
    });
  }
  positive(e) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: !1,
      message: _.toString(e)
    });
  }
  negative(e) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: !1,
      message: _.toString(e)
    });
  }
  nonpositive(e) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: !0,
      message: _.toString(e)
    });
  }
  nonnegative(e) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: !0,
      message: _.toString(e)
    });
  }
  multipleOf(e, t) {
    return this._addCheck({
      kind: "multipleOf",
      value: e,
      message: _.toString(t)
    });
  }
  finite(e) {
    return this._addCheck({
      kind: "finite",
      message: _.toString(e)
    });
  }
  safe(e) {
    return this._addCheck({
      kind: "min",
      inclusive: !0,
      value: Number.MIN_SAFE_INTEGER,
      message: _.toString(e)
    })._addCheck({
      kind: "max",
      inclusive: !0,
      value: Number.MAX_SAFE_INTEGER,
      message: _.toString(e)
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
    for (const n of this._def.checks) {
      if (n.kind === "finite" || n.kind === "int" || n.kind === "multipleOf")
        return !0;
      n.kind === "min" ? (t === null || n.value > t) && (t = n.value) : n.kind === "max" && (e === null || n.value < e) && (e = n.value);
    }
    return Number.isFinite(t) && Number.isFinite(e);
  }
}
F.create = (r) => new F({
  checks: [],
  typeName: g.ZodNumber,
  coerce: (r == null ? void 0 : r.coerce) || !1,
  ...v(r)
});
class Q extends k {
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
    if (this._getType(e) !== f.bigint)
      return this._getInvalidInput(e);
    let n;
    const i = new C();
    for (const a of this._def.checks)
      a.kind === "min" ? (a.inclusive ? e.data < a.value : e.data <= a.value) && (n = this._getOrReturnCtx(e, n), p(n, {
        code: l.too_small,
        type: "bigint",
        minimum: a.value,
        inclusive: a.inclusive,
        message: a.message
      }), i.dirty()) : a.kind === "max" ? (a.inclusive ? e.data > a.value : e.data >= a.value) && (n = this._getOrReturnCtx(e, n), p(n, {
        code: l.too_big,
        type: "bigint",
        maximum: a.value,
        inclusive: a.inclusive,
        message: a.message
      }), i.dirty()) : a.kind === "multipleOf" ? e.data % a.value !== BigInt(0) && (n = this._getOrReturnCtx(e, n), p(n, {
        code: l.not_multiple_of,
        multipleOf: a.value,
        message: a.message
      }), i.dirty()) : b.assertNever(a);
    return { status: i.value, value: e.data };
  }
  _getInvalidInput(e) {
    const t = this._getOrReturnCtx(e);
    return p(t, {
      code: l.invalid_type,
      expected: f.bigint,
      received: t.parsedType
    }), y;
  }
  gte(e, t) {
    return this.setLimit("min", e, !0, _.toString(t));
  }
  gt(e, t) {
    return this.setLimit("min", e, !1, _.toString(t));
  }
  lte(e, t) {
    return this.setLimit("max", e, !0, _.toString(t));
  }
  lt(e, t) {
    return this.setLimit("max", e, !1, _.toString(t));
  }
  setLimit(e, t, n, i) {
    return new Q({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind: e,
          value: t,
          inclusive: n,
          message: _.toString(i)
        }
      ]
    });
  }
  _addCheck(e) {
    return new Q({
      ...this._def,
      checks: [...this._def.checks, e]
    });
  }
  positive(e) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: !1,
      message: _.toString(e)
    });
  }
  negative(e) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: !1,
      message: _.toString(e)
    });
  }
  nonpositive(e) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: !0,
      message: _.toString(e)
    });
  }
  nonnegative(e) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: !0,
      message: _.toString(e)
    });
  }
  multipleOf(e, t) {
    return this._addCheck({
      kind: "multipleOf",
      value: e,
      message: _.toString(t)
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
Q.create = (r) => new Q({
  checks: [],
  typeName: g.ZodBigInt,
  coerce: (r == null ? void 0 : r.coerce) ?? !1,
  ...v(r)
});
class me extends k {
  _parse(e) {
    if (this._def.coerce && (e.data = !!e.data), this._getType(e) !== f.boolean) {
      const n = this._getOrReturnCtx(e);
      return p(n, {
        code: l.invalid_type,
        expected: f.boolean,
        received: n.parsedType
      }), y;
    }
    return A(e.data);
  }
}
me.create = (r) => new me({
  typeName: g.ZodBoolean,
  coerce: (r == null ? void 0 : r.coerce) || !1,
  ...v(r)
});
class se extends k {
  _parse(e) {
    if (this._def.coerce && (e.data = new Date(e.data)), this._getType(e) !== f.date) {
      const a = this._getOrReturnCtx(e);
      return p(a, {
        code: l.invalid_type,
        expected: f.date,
        received: a.parsedType
      }), y;
    }
    if (Number.isNaN(e.data.getTime())) {
      const a = this._getOrReturnCtx(e);
      return p(a, {
        code: l.invalid_date
      }), y;
    }
    const n = new C();
    let i;
    for (const a of this._def.checks)
      a.kind === "min" ? e.data.getTime() < a.value && (i = this._getOrReturnCtx(e, i), p(i, {
        code: l.too_small,
        message: a.message,
        inclusive: !0,
        exact: !1,
        minimum: a.value,
        type: "date"
      }), n.dirty()) : a.kind === "max" ? e.data.getTime() > a.value && (i = this._getOrReturnCtx(e, i), p(i, {
        code: l.too_big,
        message: a.message,
        inclusive: !0,
        exact: !1,
        maximum: a.value,
        type: "date"
      }), n.dirty()) : b.assertNever(a);
    return {
      status: n.value,
      value: new Date(e.data.getTime())
    };
  }
  _addCheck(e) {
    return new se({
      ...this._def,
      checks: [...this._def.checks, e]
    });
  }
  min(e, t) {
    return this._addCheck({
      kind: "min",
      value: e.getTime(),
      message: _.toString(t)
    });
  }
  max(e, t) {
    return this._addCheck({
      kind: "max",
      value: e.getTime(),
      message: _.toString(t)
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
se.create = (r) => new se({
  checks: [],
  coerce: (r == null ? void 0 : r.coerce) || !1,
  typeName: g.ZodDate,
  ...v(r)
});
class Ee extends k {
  _parse(e) {
    if (this._getType(e) !== f.symbol) {
      const n = this._getOrReturnCtx(e);
      return p(n, {
        code: l.invalid_type,
        expected: f.symbol,
        received: n.parsedType
      }), y;
    }
    return A(e.data);
  }
}
Ee.create = (r) => new Ee({
  typeName: g.ZodSymbol,
  ...v(r)
});
class Oe extends k {
  _parse(e) {
    if (this._getType(e) !== f.undefined) {
      const n = this._getOrReturnCtx(e);
      return p(n, {
        code: l.invalid_type,
        expected: f.undefined,
        received: n.parsedType
      }), y;
    }
    return A(e.data);
  }
}
Oe.create = (r) => new Oe({
  typeName: g.ZodUndefined,
  ...v(r)
});
class Ne extends k {
  _parse(e) {
    if (this._getType(e) !== f.null) {
      const n = this._getOrReturnCtx(e);
      return p(n, {
        code: l.invalid_type,
        expected: f.null,
        received: n.parsedType
      }), y;
    }
    return A(e.data);
  }
}
Ne.create = (r) => new Ne({
  typeName: g.ZodNull,
  ...v(r)
});
class Re extends k {
  constructor() {
    super(...arguments), this._any = !0;
  }
  _parse(e) {
    return A(e.data);
  }
}
Re.create = (r) => new Re({
  typeName: g.ZodAny,
  ...v(r)
});
class ge extends k {
  constructor() {
    super(...arguments), this._unknown = !0;
  }
  _parse(e) {
    return A(e.data);
  }
}
ge.create = (r) => new ge({
  typeName: g.ZodUnknown,
  ...v(r)
});
class L extends k {
  _parse(e) {
    const t = this._getOrReturnCtx(e);
    return p(t, {
      code: l.invalid_type,
      expected: f.never,
      received: t.parsedType
    }), y;
  }
}
L.create = (r) => new L({
  typeName: g.ZodNever,
  ...v(r)
});
class je extends k {
  _parse(e) {
    if (this._getType(e) !== f.undefined) {
      const n = this._getOrReturnCtx(e);
      return p(n, {
        code: l.invalid_type,
        expected: f.void,
        received: n.parsedType
      }), y;
    }
    return A(e.data);
  }
}
je.create = (r) => new je({
  typeName: g.ZodVoid,
  ...v(r)
});
class O extends k {
  _parse(e) {
    const { ctx: t, status: n } = this._processInputParams(e), i = this._def;
    if (t.parsedType !== f.array)
      return p(t, {
        code: l.invalid_type,
        expected: f.array,
        received: t.parsedType
      }), y;
    if (i.exactLength !== null) {
      const s = t.data.length > i.exactLength.value, o = t.data.length < i.exactLength.value;
      (s || o) && (p(t, {
        code: s ? l.too_big : l.too_small,
        minimum: o ? i.exactLength.value : void 0,
        maximum: s ? i.exactLength.value : void 0,
        type: "array",
        inclusive: !0,
        exact: !0,
        message: i.exactLength.message
      }), n.dirty());
    }
    if (i.minLength !== null && t.data.length < i.minLength.value && (p(t, {
      code: l.too_small,
      minimum: i.minLength.value,
      type: "array",
      inclusive: !0,
      exact: !1,
      message: i.minLength.message
    }), n.dirty()), i.maxLength !== null && t.data.length > i.maxLength.value && (p(t, {
      code: l.too_big,
      maximum: i.maxLength.value,
      type: "array",
      inclusive: !0,
      exact: !1,
      message: i.maxLength.message
    }), n.dirty()), t.common.async)
      return Promise.all([...t.data].map((s, o) => i.type._parseAsync(new R(t, s, t.path, o)))).then((s) => C.mergeArray(n, s));
    const a = [...t.data].map((s, o) => i.type._parseSync(new R(t, s, t.path, o)));
    return C.mergeArray(n, a);
  }
  get element() {
    return this._def.type;
  }
  min(e, t) {
    return new O({
      ...this._def,
      minLength: { value: e, message: _.toString(t) }
    });
  }
  max(e, t) {
    return new O({
      ...this._def,
      maxLength: { value: e, message: _.toString(t) }
    });
  }
  length(e, t) {
    return new O({
      ...this._def,
      exactLength: { value: e, message: _.toString(t) }
    });
  }
  nonempty(e) {
    return this.min(1, e);
  }
}
O.create = (r, e) => new O({
  type: r,
  minLength: null,
  maxLength: null,
  exactLength: null,
  typeName: g.ZodArray,
  ...v(e)
});
function B(r) {
  if (r instanceof S) {
    const e = {};
    for (const t in r.shape) {
      const n = r.shape[t];
      e[t] = P.create(B(n));
    }
    return new S({
      ...r._def,
      shape: () => e
    });
  } else return r instanceof O ? new O({
    ...r._def,
    type: B(r.element)
  }) : r instanceof P ? P.create(B(r.unwrap())) : r instanceof H ? H.create(B(r.unwrap())) : r instanceof z ? z.create(r.items.map((e) => B(e))) : r;
}
class S extends k {
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
    if (this._getType(e) !== f.object) {
      const d = this._getOrReturnCtx(e);
      return p(d, {
        code: l.invalid_type,
        expected: f.object,
        received: d.parsedType
      }), y;
    }
    const { status: n, ctx: i } = this._processInputParams(e), { shape: a, keys: s } = this._getCached(), o = [];
    if (!(this._def.catchall instanceof L && this._def.unknownKeys === "strip"))
      for (const d in i.data)
        s.includes(d) || o.push(d);
    const c = [];
    for (const d of s) {
      const h = a[d], I = i.data[d];
      c.push({
        key: { status: "valid", value: d },
        value: h._parse(new R(i, I, i.path, d)),
        alwaysSet: d in i.data
      });
    }
    if (this._def.catchall instanceof L) {
      const d = this._def.unknownKeys;
      if (d === "passthrough")
        for (const h of o)
          c.push({
            key: { status: "valid", value: h },
            value: { status: "valid", value: i.data[h] }
          });
      else if (d === "strict")
        o.length > 0 && (p(i, {
          code: l.unrecognized_keys,
          keys: o
        }), n.dirty());
      else if (d !== "strip") throw new Error("Internal ZodObject error: invalid unknownKeys value.");
    } else {
      const d = this._def.catchall;
      for (const h of o) {
        const I = i.data[h];
        c.push({
          key: { status: "valid", value: h },
          value: d._parse(
            new R(i, I, i.path, h)
            //, ctx.child(key), value, getParsedType(value)
          ),
          alwaysSet: h in i.data
        });
      }
    }
    return i.common.async ? Promise.resolve().then(async () => {
      const d = [];
      for (const h of c) {
        const I = await h.key, T = await h.value;
        d.push({
          key: I,
          value: T,
          alwaysSet: h.alwaysSet
        });
      }
      return d;
    }).then((d) => C.mergeObjectSync(n, d)) : C.mergeObjectSync(n, c);
  }
  get shape() {
    return this._def.shape();
  }
  strict(e) {
    return _.errToObj, new S({
      ...this._def,
      unknownKeys: "strict",
      ...e !== void 0 ? {
        errorMap: (t, n) => {
          var a, s;
          const i = ((s = (a = this._def).errorMap) == null ? void 0 : s.call(a, t, n).message) ?? n.defaultError;
          return t.code === "unrecognized_keys" ? {
            message: _.errToObj(e).message ?? i
          } : {
            message: i
          };
        }
      } : {}
    });
  }
  strip() {
    return new S({
      ...this._def,
      unknownKeys: "strip"
    });
  }
  passthrough() {
    return new S({
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
    return new S({
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
    return new S({
      unknownKeys: e._def.unknownKeys,
      catchall: e._def.catchall,
      shape: () => ({
        ...this._def.shape(),
        ...e._def.shape()
      }),
      typeName: g.ZodObject
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
    return new S({
      ...this._def,
      catchall: e
    });
  }
  pick(e) {
    const t = {};
    for (const n of b.objectKeys(e))
      e[n] && this.shape[n] && (t[n] = this.shape[n]);
    return new S({
      ...this._def,
      shape: () => t
    });
  }
  omit(e) {
    const t = {};
    for (const n of b.objectKeys(this.shape))
      e[n] || (t[n] = this.shape[n]);
    return new S({
      ...this._def,
      shape: () => t
    });
  }
  /**
   * @deprecated
   */
  deepPartial() {
    return B(this);
  }
  partial(e) {
    const t = {};
    for (const n of b.objectKeys(this.shape)) {
      const i = this.shape[n];
      e && !e[n] ? t[n] = i : t[n] = i.optional();
    }
    return new S({
      ...this._def,
      shape: () => t
    });
  }
  required(e) {
    const t = {};
    for (const n of b.objectKeys(this.shape))
      if (e && !e[n])
        t[n] = this.shape[n];
      else {
        let a = this.shape[n];
        for (; a instanceof P; )
          a = a._def.innerType;
        t[n] = a;
      }
    return new S({
      ...this._def,
      shape: () => t
    });
  }
  keyof() {
    return Fe(b.objectKeys(this.shape));
  }
}
S.create = (r, e) => new S({
  shape: () => r,
  unknownKeys: "strip",
  catchall: L.create(),
  typeName: g.ZodObject,
  ...v(e)
});
S.strictCreate = (r, e) => new S({
  shape: () => r,
  unknownKeys: "strict",
  catchall: L.create(),
  typeName: g.ZodObject,
  ...v(e)
});
S.lazycreate = (r, e) => new S({
  shape: r,
  unknownKeys: "strip",
  catchall: L.create(),
  typeName: g.ZodObject,
  ...v(e)
});
class oe extends k {
  _parse(e) {
    const { ctx: t } = this._processInputParams(e), n = this._def.options;
    function i(a) {
      for (const o of a)
        if (o.result.status === "valid")
          return o.result;
      for (const o of a)
        if (o.result.status === "dirty")
          return t.common.issues.push(...o.ctx.common.issues), o.result;
      const s = a.map((o) => new $(o.ctx.common.issues));
      return p(t, {
        code: l.invalid_union,
        unionErrors: s
      }), y;
    }
    if (t.common.async)
      return Promise.all(n.map(async (a) => {
        const s = {
          ...t,
          common: {
            ...t.common,
            issues: []
          },
          parent: null
        };
        return {
          result: await a._parseAsync({
            data: t.data,
            path: t.path,
            parent: s
          }),
          ctx: s
        };
      })).then(i);
    {
      let a;
      const s = [];
      for (const c of n) {
        const d = {
          ...t,
          common: {
            ...t.common,
            issues: []
          },
          parent: null
        }, h = c._parseSync({
          data: t.data,
          path: t.path,
          parent: d
        });
        if (h.status === "valid")
          return h;
        h.status === "dirty" && !a && (a = { result: h, ctx: d }), d.common.issues.length && s.push(d.common.issues);
      }
      if (a)
        return t.common.issues.push(...a.ctx.common.issues), a.result;
      const o = s.map((c) => new $(c));
      return p(t, {
        code: l.invalid_union,
        unionErrors: o
      }), y;
    }
  }
  get options() {
    return this._def.options;
  }
}
oe.create = (r, e) => new oe({
  options: r,
  typeName: g.ZodUnion,
  ...v(e)
});
function ye(r, e) {
  const t = M(r), n = M(e);
  if (r === e)
    return { valid: !0, data: r };
  if (t === f.object && n === f.object) {
    const i = b.objectKeys(e), a = b.objectKeys(r).filter((o) => i.indexOf(o) !== -1), s = { ...r, ...e };
    for (const o of a) {
      const c = ye(r[o], e[o]);
      if (!c.valid)
        return { valid: !1 };
      s[o] = c.data;
    }
    return { valid: !0, data: s };
  } else if (t === f.array && n === f.array) {
    if (r.length !== e.length)
      return { valid: !1 };
    const i = [];
    for (let a = 0; a < r.length; a++) {
      const s = r[a], o = e[a], c = ye(s, o);
      if (!c.valid)
        return { valid: !1 };
      i.push(c.data);
    }
    return { valid: !0, data: i };
  } else return t === f.date && n === f.date && +r == +e ? { valid: !0, data: r } : { valid: !1 };
}
class ce extends k {
  _parse(e) {
    const { status: t, ctx: n } = this._processInputParams(e), i = (a, s) => {
      if (Ce(a) || Ce(s))
        return y;
      const o = ye(a.value, s.value);
      return o.valid ? ((Ae(a) || Ae(s)) && t.dirty(), { status: t.value, value: o.data }) : (p(n, {
        code: l.invalid_intersection_types
      }), y);
    };
    return n.common.async ? Promise.all([
      this._def.left._parseAsync({
        data: n.data,
        path: n.path,
        parent: n
      }),
      this._def.right._parseAsync({
        data: n.data,
        path: n.path,
        parent: n
      })
    ]).then(([a, s]) => i(a, s)) : i(this._def.left._parseSync({
      data: n.data,
      path: n.path,
      parent: n
    }), this._def.right._parseSync({
      data: n.data,
      path: n.path,
      parent: n
    }));
  }
}
ce.create = (r, e, t) => new ce({
  left: r,
  right: e,
  typeName: g.ZodIntersection,
  ...v(t)
});
class z extends k {
  _parse(e) {
    const { status: t, ctx: n } = this._processInputParams(e);
    if (n.parsedType !== f.array)
      return p(n, {
        code: l.invalid_type,
        expected: f.array,
        received: n.parsedType
      }), y;
    if (n.data.length < this._def.items.length)
      return p(n, {
        code: l.too_small,
        minimum: this._def.items.length,
        inclusive: !0,
        exact: !1,
        type: "array"
      }), y;
    !this._def.rest && n.data.length > this._def.items.length && (p(n, {
      code: l.too_big,
      maximum: this._def.items.length,
      inclusive: !0,
      exact: !1,
      type: "array"
    }), t.dirty());
    const a = [...n.data].map((s, o) => {
      const c = this._def.items[o] || this._def.rest;
      return c ? c._parse(new R(n, s, n.path, o)) : null;
    }).filter((s) => !!s);
    return n.common.async ? Promise.all(a).then((s) => C.mergeArray(t, s)) : C.mergeArray(t, a);
  }
  get items() {
    return this._def.items;
  }
  rest(e) {
    return new z({
      ...this._def,
      rest: e
    });
  }
}
z.create = (r, e) => {
  if (!Array.isArray(r))
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  return new z({
    items: r,
    typeName: g.ZodTuple,
    rest: null,
    ...v(e)
  });
};
class le extends k {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(e) {
    const { status: t, ctx: n } = this._processInputParams(e);
    if (n.parsedType !== f.object)
      return p(n, {
        code: l.invalid_type,
        expected: f.object,
        received: n.parsedType
      }), y;
    const i = [], a = this._def.keyType, s = this._def.valueType;
    for (const o in n.data)
      i.push({
        key: a._parse(new R(n, o, n.path, o)),
        value: s._parse(new R(n, n.data[o], n.path, o)),
        alwaysSet: o in n.data
      });
    return n.common.async ? C.mergeObjectAsync(t, i) : C.mergeObjectSync(t, i);
  }
  get element() {
    return this._def.valueType;
  }
  static create(e, t, n) {
    return t instanceof k ? new le({
      keyType: e,
      valueType: t,
      typeName: g.ZodRecord,
      ...v(n)
    }) : new le({
      keyType: Z.create(),
      valueType: e,
      typeName: g.ZodRecord,
      ...v(t)
    });
  }
}
class Ze extends k {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(e) {
    const { status: t, ctx: n } = this._processInputParams(e);
    if (n.parsedType !== f.map)
      return p(n, {
        code: l.invalid_type,
        expected: f.map,
        received: n.parsedType
      }), y;
    const i = this._def.keyType, a = this._def.valueType, s = [...n.data.entries()].map(([o, c], d) => ({
      key: i._parse(new R(n, o, n.path, [d, "key"])),
      value: a._parse(new R(n, c, n.path, [d, "value"]))
    }));
    if (n.common.async) {
      const o = /* @__PURE__ */ new Map();
      return Promise.resolve().then(async () => {
        for (const c of s) {
          const d = await c.key, h = await c.value;
          if (d.status === "aborted" || h.status === "aborted")
            return y;
          (d.status === "dirty" || h.status === "dirty") && t.dirty(), o.set(d.value, h.value);
        }
        return { status: t.value, value: o };
      });
    } else {
      const o = /* @__PURE__ */ new Map();
      for (const c of s) {
        const d = c.key, h = c.value;
        if (d.status === "aborted" || h.status === "aborted")
          return y;
        (d.status === "dirty" || h.status === "dirty") && t.dirty(), o.set(d.value, h.value);
      }
      return { status: t.value, value: o };
    }
  }
}
Ze.create = (r, e, t) => new Ze({
  valueType: e,
  keyType: r,
  typeName: g.ZodMap,
  ...v(t)
});
class Y extends k {
  _parse(e) {
    const { status: t, ctx: n } = this._processInputParams(e);
    if (n.parsedType !== f.set)
      return p(n, {
        code: l.invalid_type,
        expected: f.set,
        received: n.parsedType
      }), y;
    const i = this._def;
    i.minSize !== null && n.data.size < i.minSize.value && (p(n, {
      code: l.too_small,
      minimum: i.minSize.value,
      type: "set",
      inclusive: !0,
      exact: !1,
      message: i.minSize.message
    }), t.dirty()), i.maxSize !== null && n.data.size > i.maxSize.value && (p(n, {
      code: l.too_big,
      maximum: i.maxSize.value,
      type: "set",
      inclusive: !0,
      exact: !1,
      message: i.maxSize.message
    }), t.dirty());
    const a = this._def.valueType;
    function s(c) {
      const d = /* @__PURE__ */ new Set();
      for (const h of c) {
        if (h.status === "aborted")
          return y;
        h.status === "dirty" && t.dirty(), d.add(h.value);
      }
      return { status: t.value, value: d };
    }
    const o = [...n.data.values()].map((c, d) => a._parse(new R(n, c, n.path, d)));
    return n.common.async ? Promise.all(o).then((c) => s(c)) : s(o);
  }
  min(e, t) {
    return new Y({
      ...this._def,
      minSize: { value: e, message: _.toString(t) }
    });
  }
  max(e, t) {
    return new Y({
      ...this._def,
      maxSize: { value: e, message: _.toString(t) }
    });
  }
  size(e, t) {
    return this.min(e, t).max(e, t);
  }
  nonempty(e) {
    return this.min(1, e);
  }
}
Y.create = (r, e) => new Y({
  valueType: r,
  minSize: null,
  maxSize: null,
  typeName: g.ZodSet,
  ...v(e)
});
class $e extends k {
  get schema() {
    return this._def.getter();
  }
  _parse(e) {
    const { ctx: t } = this._processInputParams(e);
    return this._def.getter()._parse({ data: t.data, path: t.path, parent: t });
  }
}
$e.create = (r, e) => new $e({
  getter: r,
  typeName: g.ZodLazy,
  ...v(e)
});
class Me extends k {
  _parse(e) {
    if (e.data !== this._def.value) {
      const t = this._getOrReturnCtx(e);
      return p(t, {
        received: t.data,
        code: l.invalid_literal,
        expected: this._def.value
      }), y;
    }
    return { status: "valid", value: e.data };
  }
  get value() {
    return this._def.value;
  }
}
Me.create = (r, e) => new Me({
  value: r,
  typeName: g.ZodLiteral,
  ...v(e)
});
function Fe(r, e) {
  return new W({
    values: r,
    typeName: g.ZodEnum,
    ...v(e)
  });
}
class W extends k {
  _parse(e) {
    if (typeof e.data != "string") {
      const t = this._getOrReturnCtx(e), n = this._def.values;
      return p(t, {
        expected: b.joinValues(n),
        received: t.parsedType,
        code: l.invalid_type
      }), y;
    }
    if (this._cache || (this._cache = new Set(this._def.values)), !this._cache.has(e.data)) {
      const t = this._getOrReturnCtx(e), n = this._def.values;
      return p(t, {
        received: t.data,
        code: l.invalid_enum_value,
        options: n
      }), y;
    }
    return A(e.data);
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
    return W.create(e, {
      ...this._def,
      ...t
    });
  }
  exclude(e, t = this._def) {
    return W.create(this.options.filter((n) => !e.includes(n)), {
      ...this._def,
      ...t
    });
  }
}
W.create = Fe;
class Pe extends k {
  _parse(e) {
    const t = b.getValidEnumValues(this._def.values), n = this._getOrReturnCtx(e);
    if (n.parsedType !== f.string && n.parsedType !== f.number) {
      const i = b.objectValues(t);
      return p(n, {
        expected: b.joinValues(i),
        received: n.parsedType,
        code: l.invalid_type
      }), y;
    }
    if (this._cache || (this._cache = new Set(b.getValidEnumValues(this._def.values))), !this._cache.has(e.data)) {
      const i = b.objectValues(t);
      return p(n, {
        received: n.data,
        code: l.invalid_enum_value,
        options: i
      }), y;
    }
    return A(e.data);
  }
  get enum() {
    return this._def.values;
  }
}
Pe.create = (r, e) => new Pe({
  values: r,
  typeName: g.ZodNativeEnum,
  ...v(e)
});
class de extends k {
  unwrap() {
    return this._def.type;
  }
  _parse(e) {
    const { ctx: t } = this._processInputParams(e);
    if (t.parsedType !== f.promise && t.common.async === !1)
      return p(t, {
        code: l.invalid_type,
        expected: f.promise,
        received: t.parsedType
      }), y;
    const n = t.parsedType === f.promise ? t.data : Promise.resolve(t.data);
    return A(n.then((i) => this._def.type.parseAsync(i, {
      path: t.path,
      errorMap: t.common.contextualErrorMap
    })));
  }
}
de.create = (r, e) => new de({
  type: r,
  typeName: g.ZodPromise,
  ...v(e)
});
class D extends k {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === g.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(e) {
    const { status: t, ctx: n } = this._processInputParams(e), i = this._def.effect || null, a = {
      addIssue: (s) => {
        p(n, s), s.fatal ? t.abort() : t.dirty();
      },
      get path() {
        return n.path;
      }
    };
    if (a.addIssue = a.addIssue.bind(a), i.type === "preprocess") {
      const s = i.transform(n.data, a);
      if (n.common.async)
        return Promise.resolve(s).then(async (o) => {
          if (t.value === "aborted")
            return y;
          const c = await this._def.schema._parseAsync({
            data: o,
            path: n.path,
            parent: n
          });
          return c.status === "aborted" ? y : c.status === "dirty" || t.value === "dirty" ? K(c.value) : c;
        });
      {
        if (t.value === "aborted")
          return y;
        const o = this._def.schema._parseSync({
          data: s,
          path: n.path,
          parent: n
        });
        return o.status === "aborted" ? y : o.status === "dirty" || t.value === "dirty" ? K(o.value) : o;
      }
    }
    if (i.type === "refinement") {
      const s = (o) => {
        const c = i.refinement(o, a);
        if (n.common.async)
          return Promise.resolve(c);
        if (c instanceof Promise)
          throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        return o;
      };
      if (n.common.async === !1) {
        const o = this._def.schema._parseSync({
          data: n.data,
          path: n.path,
          parent: n
        });
        return o.status === "aborted" ? y : (o.status === "dirty" && t.dirty(), s(o.value), { status: t.value, value: o.value });
      } else
        return this._def.schema._parseAsync({ data: n.data, path: n.path, parent: n }).then((o) => o.status === "aborted" ? y : (o.status === "dirty" && t.dirty(), s(o.value).then(() => ({ status: t.value, value: o.value }))));
    }
    if (i.type === "transform")
      if (n.common.async === !1) {
        const s = this._def.schema._parseSync({
          data: n.data,
          path: n.path,
          parent: n
        });
        if (!U(s))
          return y;
        const o = i.transform(s.value, a);
        if (o instanceof Promise)
          throw new Error("Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.");
        return { status: t.value, value: o };
      } else
        return this._def.schema._parseAsync({ data: n.data, path: n.path, parent: n }).then((s) => U(s) ? Promise.resolve(i.transform(s.value, a)).then((o) => ({
          status: t.value,
          value: o
        })) : y);
    b.assertNever(i);
  }
}
D.create = (r, e, t) => new D({
  schema: r,
  typeName: g.ZodEffects,
  effect: e,
  ...v(t)
});
D.createWithPreprocess = (r, e, t) => new D({
  schema: e,
  effect: { type: "preprocess", transform: r },
  typeName: g.ZodEffects,
  ...v(t)
});
class P extends k {
  _parse(e) {
    return this._getType(e) === f.undefined ? A(void 0) : this._def.innerType._parse(e);
  }
  unwrap() {
    return this._def.innerType;
  }
}
P.create = (r, e) => new P({
  innerType: r,
  typeName: g.ZodOptional,
  ...v(e)
});
class H extends k {
  _parse(e) {
    return this._getType(e) === f.null ? A(null) : this._def.innerType._parse(e);
  }
  unwrap() {
    return this._def.innerType;
  }
}
H.create = (r, e) => new H({
  innerType: r,
  typeName: g.ZodNullable,
  ...v(e)
});
class ve extends k {
  _parse(e) {
    const { ctx: t } = this._processInputParams(e);
    let n = t.data;
    return t.parsedType === f.undefined && (n = this._def.defaultValue()), this._def.innerType._parse({
      data: n,
      path: t.path,
      parent: t
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
}
ve.create = (r, e) => new ve({
  innerType: r,
  typeName: g.ZodDefault,
  defaultValue: typeof e.default == "function" ? e.default : () => e.default,
  ...v(e)
});
class ke extends k {
  _parse(e) {
    const { ctx: t } = this._processInputParams(e), n = {
      ...t,
      common: {
        ...t.common,
        issues: []
      }
    }, i = this._def.innerType._parse({
      data: n.data,
      path: n.path,
      parent: {
        ...n
      }
    });
    return ae(i) ? i.then((a) => ({
      status: "valid",
      value: a.status === "valid" ? a.value : this._def.catchValue({
        get error() {
          return new $(n.common.issues);
        },
        input: n.data
      })
    })) : {
      status: "valid",
      value: i.status === "valid" ? i.value : this._def.catchValue({
        get error() {
          return new $(n.common.issues);
        },
        input: n.data
      })
    };
  }
  removeCatch() {
    return this._def.innerType;
  }
}
ke.create = (r, e) => new ke({
  innerType: r,
  typeName: g.ZodCatch,
  catchValue: typeof e.catch == "function" ? e.catch : () => e.catch,
  ...v(e)
});
class Le extends k {
  _parse(e) {
    if (this._getType(e) !== f.nan) {
      const n = this._getOrReturnCtx(e);
      return p(n, {
        code: l.invalid_type,
        expected: f.nan,
        received: n.parsedType
      }), y;
    }
    return { status: "valid", value: e.data };
  }
}
Le.create = (r) => new Le({
  typeName: g.ZodNaN,
  ...v(r)
});
class jt extends k {
  _parse(e) {
    const { ctx: t } = this._processInputParams(e), n = t.data;
    return this._def.type._parse({
      data: n,
      path: t.path,
      parent: t
    });
  }
  unwrap() {
    return this._def.type;
  }
}
class xe extends k {
  _parse(e) {
    const { status: t, ctx: n } = this._processInputParams(e);
    if (n.common.async)
      return (async () => {
        const a = await this._def.in._parseAsync({
          data: n.data,
          path: n.path,
          parent: n
        });
        return a.status === "aborted" ? y : a.status === "dirty" ? (t.dirty(), K(a.value)) : this._def.out._parseAsync({
          data: a.value,
          path: n.path,
          parent: n
        });
      })();
    {
      const i = this._def.in._parseSync({
        data: n.data,
        path: n.path,
        parent: n
      });
      return i.status === "aborted" ? y : i.status === "dirty" ? (t.dirty(), {
        status: "dirty",
        value: i.value
      }) : this._def.out._parseSync({
        data: i.value,
        path: n.path,
        parent: n
      });
    }
  }
  static create(e, t) {
    return new xe({
      in: e,
      out: t,
      typeName: g.ZodPipeline
    });
  }
}
class be extends k {
  _parse(e) {
    const t = this._def.innerType._parse(e), n = (i) => (U(i) && (i.value = Object.freeze(i.value)), i);
    return ae(t) ? t.then((i) => n(i)) : n(t);
  }
  unwrap() {
    return this._def.innerType;
  }
}
be.create = (r, e) => new be({
  innerType: r,
  typeName: g.ZodReadonly,
  ...v(e)
});
var g;
(function(r) {
  r.ZodString = "ZodString", r.ZodNumber = "ZodNumber", r.ZodNaN = "ZodNaN", r.ZodBigInt = "ZodBigInt", r.ZodBoolean = "ZodBoolean", r.ZodDate = "ZodDate", r.ZodSymbol = "ZodSymbol", r.ZodUndefined = "ZodUndefined", r.ZodNull = "ZodNull", r.ZodAny = "ZodAny", r.ZodUnknown = "ZodUnknown", r.ZodNever = "ZodNever", r.ZodVoid = "ZodVoid", r.ZodArray = "ZodArray", r.ZodObject = "ZodObject", r.ZodUnion = "ZodUnion", r.ZodDiscriminatedUnion = "ZodDiscriminatedUnion", r.ZodIntersection = "ZodIntersection", r.ZodTuple = "ZodTuple", r.ZodRecord = "ZodRecord", r.ZodMap = "ZodMap", r.ZodSet = "ZodSet", r.ZodFunction = "ZodFunction", r.ZodLazy = "ZodLazy", r.ZodLiteral = "ZodLiteral", r.ZodEnum = "ZodEnum", r.ZodEffects = "ZodEffects", r.ZodNativeEnum = "ZodNativeEnum", r.ZodOptional = "ZodOptional", r.ZodNullable = "ZodNullable", r.ZodDefault = "ZodDefault", r.ZodCatch = "ZodCatch", r.ZodPromise = "ZodPromise", r.ZodBranded = "ZodBranded", r.ZodPipeline = "ZodPipeline", r.ZodReadonly = "ZodReadonly";
})(g || (g = {}));
const m = Z.create, re = F.create, we = me.create, Se = ge.create;
L.create;
const N = O.create, E = S.create;
oe.create;
ce.create;
z.create;
const ne = le.create, j = W.create;
de.create;
P.create;
H.create;
const We = D.createWithPreprocess, Zt = j(["log", "span", "metric"]), $t = j(["ok", "error", "unset"]), Mt = j(["counter", "gauge", "histogram", "summary"]), Pt = j([
  "json",
  "rpc",
  "protobuf",
  "text",
  "binary",
  "stream"
]), Lt = j(["raw", "base64", "gzip+base64", "protobuf"]), zt = E({
  log_id: m().min(1),
  timestamp: m().datetime(),
  record_kind: Zt,
  trace_id: m().min(1),
  span_id: m().min(1),
  parent_span_id: m().optional(),
  event_key: m().min(1),
  event_version: m().regex(/^\d{3}$/),
  span_name: m().optional(),
  start_time: m().datetime().optional(),
  end_time: m().datetime().optional(),
  status_code: $t.optional(),
  payload_format: Pt,
  payload_encoding: Lt,
  payload_masking_applied: we(),
  payload_masked_fields: N(m()),
  payload: Se(),
  qa_session_id: m().optional(),
  // Address context
  address_context: ne(m(), m()).optional(),
  // Metric (when record_kind === "metric")
  metric_type: Mt.optional(),
  metric_name: m().optional(),
  metric_value: re().optional(),
  metric_unit: m().optional(),
  metric_labels: ne(m(), m()).optional(),
  metric_buckets: N(re()).optional(),
  metric_quantiles: N(re()).optional(),
  actor_id: m().optional(),
  user_id: m().optional(),
  user_attributes: ne(m()).optional()
}), Dt = j([
  "tenant",
  "workspace",
  "user",
  "agent"
]), Vt = E({
  owner_type: Dt,
  owner_id: m().min(1)
}), Bt = E({
  service_name: m().min(1),
  sdk_name: m().min(1),
  sdk_version: m().min(1)
}), Ut = E({
  platform: m().min(1),
  device_ref: m().optional(),
  os_version: m().optional(),
  app_version: m().optional()
}), Ft = m().min(1), Wt = E({
  env: Ft,
  build_ref: m().optional(),
  release_version: m().optional()
});
E({
  transmission_id: m().min(1),
  sent_at: m().datetime(),
  owner: Vt,
  source: Bt,
  runtime: Ut,
  build: Wt,
  infra_context: ne(m(), m()).optional(),
  entry_snapshot: m().optional(),
  records: N(zt).min(1)
});
const Ht = j([
  "eq",
  "neq",
  "exists",
  "gt",
  "lt",
  "contains",
  "masked"
]), He = E({
  field: m().min(1),
  op: Ht,
  value: Se().optional()
}), Gt = E({
  field: m().min(1),
  op: j(["eq", "neq", "exists", "gt", "lt", "contains"]),
  value: Se().optional()
}), Kt = E({
  condition: He,
  next: N(m().min(1))
}), Jt = j(["sequence", "optional", "branch"]), Qt = E({
  id: m().min(1),
  event_key: m().min(1),
  event_version: m().regex(/^\d{3}$/).optional(),
  source: m().optional(),
  record_kind: j(["log", "span"]).optional(),
  required: we(),
  kind: Jt,
  constraints: N(He).optional(),
  timeout_ms: re().int().positive().optional(),
  next: N(m().min(1)).optional(),
  branches: N(Kt).optional()
});
E({
  scenario_id: m().min(1),
  version: m().min(1),
  domain: m().min(1),
  description: m().optional(),
  entry_conditions: N(Gt).optional(),
  steps: N(Qt).min(1)
});
function ie(r) {
  const e = new Error(r);
  return e.source = "ulid", e;
}
const Te = "0123456789ABCDEFGHJKMNPQRSTVWXYZ", J = Te.length, ze = Math.pow(2, 48) - 1, Yt = 10, Xt = 16;
function er(r) {
  let e = Math.floor(r() * J);
  return e === J && (e = J - 1), Te.charAt(e);
}
function tr(r, e) {
  if (isNaN(r))
    throw new Error(r + " must be a number");
  if (r > ze)
    throw ie("cannot encode time greater than " + ze);
  if (r < 0)
    throw ie("time must be positive");
  if (Number.isInteger(Number(r)) === !1)
    throw ie("time must be an integer");
  let t, n = "";
  for (; e > 0; e--)
    t = r % J, n = Te.charAt(t) + n, r = (r - t) / J;
  return n;
}
function rr(r, e) {
  let t = "";
  for (; r > 0; r--)
    t = er(e) + t;
  return t;
}
function nr(r = !1, e) {
  e || (e = typeof window < "u" ? window : null);
  const t = e && (e.crypto || e.msCrypto);
  if (t)
    return () => {
      const n = new Uint8Array(1);
      return t.getRandomValues(n), n[0] / 255;
    };
  try {
    const n = require("crypto");
    return () => n.randomBytes(1).readUInt8() / 255;
  } catch {
  }
  if (r) {
    try {
      console.error("secure crypto unusable, falling back to insecure Math.random()!");
    } catch {
    }
    return () => Math.random();
  }
  throw ie("secure crypto unusable, insecure Math.random not allowed");
}
function ir(r) {
  return r || (r = nr()), function(t) {
    return isNaN(t) && (t = Date.now()), tr(t, Yt) + rr(Xt, r);
  };
}
const te = ir();
function ar() {
  return `txm_${te()}`;
}
function _e() {
  return `log_${te()}`;
}
function Ge() {
  return `trc_${te()}`;
}
function sr() {
  return `spn_${te()}`;
}
function or() {
  return `qas_${te()}`;
}
function V() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
const cr = (r) => typeof r == "string" && r.trim().length === 0 ? void 0 : r;
We(cr, m().url().optional());
We((r) => {
  if (typeof r == "boolean")
    return r;
  if (typeof r == "string") {
    const e = r.trim().toLowerCase();
    if (e.length === 0)
      return;
    if (e === "true")
      return !0;
    if (e === "false")
      return !1;
  }
  return r;
}, we().default(!1));
class ue {
  constructor(e) {
    w(this, "trace_id");
    w(this, "spanStack", []);
    w(this, "qa_session_id");
    this.trace_id = (e == null ? void 0 : e.trace_id) ?? Ge(), this.qa_session_id = e == null ? void 0 : e.qa_session_id;
  }
  /** Push a new span onto the stack. Returns the new span_id. */
  pushSpan(e) {
    const t = e ?? sr();
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
function lr(r, e) {
  const t = { ...r }, n = [];
  for (const i of e)
    if (i.field in t)
      switch (n.push(i.field), i.mode) {
        case "raw":
          break;
        case "mask": {
          const a = {
            _masked: !0,
            _present: t[i.field] !== void 0 && t[i.field] !== null
          };
          t[i.field] = a;
          break;
        }
        case "drop":
          delete t[i.field];
          break;
        case "hash": {
          const a = t[i.field];
          t[i.field] = dr(String(a));
          break;
        }
      }
  return { masked: t, maskedFields: n };
}
function dr(r) {
  let e = 0;
  for (let t = 0; t < r.length; t++) {
    const n = r.charCodeAt(t);
    e = (e << 5) - e + n | 0;
  }
  return `h_${(e >>> 0).toString(16).padStart(8, "0")}`;
}
const ur = 50, pr = 5e3, fr = 500;
class _r {
  constructor(e) {
    w(this, "config");
    w(this, "batchSize");
    w(this, "flushIntervalMs");
    w(this, "maxBufferSize");
    w(this, "buffer", []);
    w(this, "flushTimer", null);
    w(this, "activeContext", null);
    w(this, "actor", null);
    /** Prevents concurrent flush calls (interval + batch-size trigger). */
    w(this, "flushInProgress", !1);
    this.config = e, this.batchSize = e.batchSize ?? ur, this.flushIntervalMs = e.flushIntervalMs ?? pr, this.maxBufferSize = e.maxBufferSize ?? fr, this.flushIntervalMs > 0 && (this.flushTimer = setInterval(() => {
      this.flush().catch((t) => this.handleError(t, "interval-flush"));
    }, this.flushIntervalMs)), e.actor && (this.actor = e.actor);
  }
  // ── Context Management ─────────────────────────────
  /** Start a new trace context (or attach to existing trace). */
  startTrace(e) {
    return this.activeContext = new ue(e), this.activeContext;
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
    const t = this.ensureContext(), { payload: n, maskedFields: i, maskingApplied: a } = this.processPayload(e.payload), s = {
      log_id: _e(),
      timestamp: V(),
      record_kind: "log",
      trace_id: t.trace_id,
      span_id: t.currentSpanId,
      parent_span_id: t.parentSpanId,
      event_key: e.event_key,
      event_version: e.event_version,
      payload_format: e.payload_format ?? "json",
      payload_encoding: e.payload_encoding ?? "raw",
      payload_masking_applied: a,
      payload_masked_fields: i,
      payload: n,
      qa_session_id: e.qa_session_id ?? t.qa_session_id,
      ...e.address_context ? { address_context: e.address_context } : {},
      ...this.actorFields()
    };
    return this.addRecord(s), s;
  }
  // ── Span ───────────────────────────────────────────
  /** Start a span. Returns a handle to end it. */
  startSpan(e) {
    const t = this.ensureContext(), n = t.pushSpan(), i = t.parentSpanId, a = V();
    return {
      span_id: n,
      end: (s) => {
        t.popSpan();
        const o = {
          ...e.payload,
          ...s == null ? void 0 : s.payload
        }, { payload: c, maskedFields: d, maskingApplied: h } = this.processPayload(Object.keys(o).length > 0 ? o : void 0), I = {
          log_id: _e(),
          timestamp: V(),
          record_kind: "span",
          trace_id: t.trace_id,
          span_id: n,
          parent_span_id: i,
          event_key: e.event_key,
          event_version: e.event_version,
          span_name: e.span_name,
          start_time: a,
          end_time: V(),
          status_code: (s == null ? void 0 : s.status_code) ?? "ok",
          payload_format: e.payload_format ?? "json",
          payload_encoding: e.payload_encoding ?? "raw",
          payload_masking_applied: h,
          payload_masked_fields: d,
          payload: c,
          qa_session_id: e.qa_session_id ?? t.qa_session_id,
          ...e.address_context ? { address_context: e.address_context } : {},
          ...this.actorFields()
        };
        return this.addRecord(I), I;
      }
    };
  }
  // ── Metric ──────────────────────────────────────────
  /** Record a metric event. */
  metric(e, t, n) {
    const i = this.ensureContext(), a = {
      log_id: _e(),
      timestamp: V(),
      record_kind: "metric",
      trace_id: i.trace_id,
      span_id: i.currentSpanId,
      parent_span_id: i.parentSpanId,
      event_key: e,
      event_version: "1",
      payload_format: "json",
      payload_encoding: "raw",
      payload_masking_applied: !1,
      payload_masked_fields: [],
      payload: null,
      qa_session_id: i.qa_session_id,
      metric_type: (n == null ? void 0 : n.type) ?? "gauge",
      metric_name: e,
      metric_value: t,
      ...n != null && n.unit ? { metric_unit: n.unit } : {},
      ...n != null && n.labels ? { metric_labels: n.labels } : {},
      ...n != null && n.buckets ? { metric_buckets: n.buckets } : {},
      ...n != null && n.quantiles ? { metric_quantiles: n.quantiles } : {},
      ...n != null && n.address_context ? { address_context: n.address_context } : {},
      ...this.actorFields()
    };
    return this.addRecord(a), a;
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
      const n = [...e, ...this.buffer];
      if (n.length > this.maxBufferSize) {
        const a = n.splice(0, n.length - this.maxBufferSize);
        this.handleError(new Error(`[qa-sdk:flush] buffer overflow — dropped ${a.length} oldest records`), "buffer-overflow");
      }
      this.buffer = n;
      const i = t instanceof Error ? t : new Error(String(t));
      throw new Error(`[qa-sdk:flush] transport.send failed: ${i.message}`, { cause: i });
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
    return this.activeContext || (this.activeContext = new ue()), this.activeContext;
  }
  processPayload(e) {
    if (!e)
      return { payload: null, maskedFields: [], maskingApplied: !1 };
    const t = this.config.maskingRules;
    if (!t || t.length === 0)
      return { payload: e, maskedFields: [], maskingApplied: !1 };
    const { masked: n, maskedFields: i } = lr(e, t);
    return {
      payload: n,
      maskedFields: i,
      maskingApplied: i.length > 0
    };
  }
  addRecord(e) {
    this.buffer.length >= this.maxBufferSize && (this.buffer.shift(), this.handleError(new Error(`[qa-sdk:addRecord] buffer at cap (${this.maxBufferSize}) — dropping oldest record`), "buffer-overflow")), this.buffer.push(e), !this.flushInProgress && this.buffer.length >= this.batchSize && this.flush().catch((t) => this.handleError(t, "batch-flush"));
  }
  handleError(e, t) {
    const n = e instanceof Error ? e : new Error(String(e));
    this.config.onError ? this.config.onError(n, t) : console.error(`[qa-sdk:${t}]`, n);
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
      transmission_id: ar(),
      sent_at: V(),
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
function G(r) {
  var t;
  if (!r.name) throw new RangeError("PackFormat: name is required");
  if (r.chars <= 0) throw new RangeError(`PackFormat "${r.name}": chars must be > 0`);
  const e = (t = r.groups) != null && t.length ? Object.freeze([...r.groups]) : void 0;
  if (e) {
    const n = e.reduce((i, a) => i + a, 0);
    if (n !== r.chars)
      throw new RangeError(
        `PackFormat "${r.name}": groups sum (${n}) ≠ chars (${r.chars})`
      );
    if (e.some((i) => i <= 0))
      throw new RangeError(`PackFormat "${r.name}": each group must be > 0`);
  }
  return Object.freeze({
    name: r.name,
    chars: r.chars,
    bits: r.chars * 4,
    label: r.label,
    groups: e
  });
}
G({ name: "int64", chars: 16, label: "64-bit Integer" }), G({ name: "objectId", chars: 24, label: "96-bit ObjectId" }), G({ name: "uuid", chars: 32, label: "UUID (128-bit)", groups: [8, 4, 4, 4, 12] }), G({ name: "sha1", chars: 40, label: "160-bit (SHA-1)" }), G({ name: "sha256", chars: 64, label: "256-bit (SHA-256)" });
const hr = [
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
], mr = [
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
], gr = [
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
], yr = [
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
], vr = [
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
], kr = [
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
], br = [
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
], xr = [
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
], Ke = [
  ...hr,
  ...mr,
  ...gr,
  ...yr,
  ...vr,
  ...kr,
  ...br,
  ...xr
], Je = new Map(Ke.map((r) => [r.event_key, r]));
function wr(r) {
  return Je.get(r);
}
Ke.filter((r) => r.auto_collectable);
const Sr = [
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
new Map(Sr.map((r) => [r.event_key, r]));
const Tr = [
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
Tr.map((r) => {
  const e = Je.get(r);
  if (!e)
    throw new Error(`v1 minimal event not found in registry: ${r}`);
  return e;
});
const u = (r) => ({ kind: "fixed", value: r }), x = (r) => ({ kind: "context", contextKey: r }), Ir = [
  // ── 네비게이션 ──
  {
    event_key: "page.view",
    domain: "navigation",
    prefixes: [
      { prefixId: "page_view", dims: { page: x("page"), locale: x("locale"), userType: x("userType") } },
      { prefixId: "tracking", dims: { trackAction: u("view"), page: x("page"), userType: x("userType") } }
    ]
  },
  // ── 인증 ──
  {
    event_key: "auth.login",
    domain: "auth",
    prefixes: [
      { prefixId: "page_view", dims: { page: u("login"), locale: x("locale"), userType: u("guest") } },
      { prefixId: "tracking", dims: { trackAction: u("submit"), page: u("login"), userType: u("guest") } },
      { prefixId: "auth_event", dims: { action: u("login") } },
      { prefixId: "endpoint", dims: { resource_type: u("api"), http_method: u("POST"), api_version: u("v1") } },
      { prefixId: "flow_point", dims: { flow_name: u("login"), flow_step: u("entry"), flow_variant: u("default") } },
      { prefixId: "permission", dims: { role: u("customer") } }
    ]
  },
  {
    event_key: "auth.logout",
    domain: "auth",
    prefixes: [
      { prefixId: "tracking", dims: { trackAction: u("close"), page: x("page"), userType: x("userType") } },
      { prefixId: "auth_event", dims: { action: u("logout") } },
      { prefixId: "endpoint", dims: { resource_type: u("api"), http_method: u("POST"), api_version: u("v1") } },
      { prefixId: "flow_point", dims: { flow_name: u("browse"), flow_step: u("exit"), flow_variant: u("default") } }
    ]
  },
  // ── 상품 ──
  {
    event_key: "product.list",
    domain: "commerce",
    prefixes: [
      { prefixId: "tracking", dims: { trackAction: u("view"), page: u("product_list"), userType: x("userType") } },
      { prefixId: "endpoint", dims: { resource_type: u("api"), http_method: u("GET"), api_version: u("v1") } }
    ]
  },
  {
    event_key: "product.detail",
    domain: "commerce",
    prefixes: [
      { prefixId: "page_view", dims: { page: u("product_detail"), locale: x("locale"), userType: x("userType") } },
      { prefixId: "tracking", dims: { trackAction: u("click"), page: u("product_detail"), userType: x("userType") } },
      { prefixId: "endpoint", dims: { resource_type: u("api"), http_method: u("GET"), api_version: u("v1") } }
    ]
  },
  // ── 장바구니 ──
  {
    event_key: "cart.add",
    domain: "commerce",
    prefixes: [
      { prefixId: "tracking", dims: { trackAction: u("add_to_cart"), page: x("page"), userType: x("userType") } },
      { prefixId: "endpoint", dims: { resource_type: u("api"), http_method: u("POST"), api_version: u("v1") } },
      { prefixId: "cart_event", dims: { action: u("add") } }
    ]
  },
  {
    event_key: "cart.remove",
    domain: "commerce",
    prefixes: [
      { prefixId: "tracking", dims: { trackAction: u("click"), page: u("cart"), userType: x("userType") } },
      { prefixId: "cart_event", dims: { action: u("remove") } }
    ]
  },
  // ── 결제 ──
  {
    event_key: "checkout.entry",
    domain: "commerce",
    prefixes: [
      { prefixId: "page_view", dims: { page: u("checkout"), locale: x("locale"), userType: x("userType") } },
      { prefixId: "tracking", dims: { trackAction: u("navigate"), page: u("checkout"), userType: x("userType") } },
      { prefixId: "endpoint", dims: { resource_type: u("page"), http_method: u("GET"), api_version: u("v1") } },
      { prefixId: "flow_point", dims: { flow_name: u("checkout"), flow_step: u("entry"), flow_variant: u("default") } },
      { prefixId: "permission", dims: { role: u("customer") } }
    ]
  },
  {
    event_key: "checkout.process",
    domain: "commerce",
    prefixes: [
      { prefixId: "page_view", dims: { page: u("checkout"), locale: x("locale"), userType: x("userType") } },
      { prefixId: "tracking", dims: { trackAction: u("submit"), page: u("checkout"), userType: x("userType") } },
      { prefixId: "endpoint", dims: { resource_type: u("api"), http_method: u("POST"), api_version: u("v1") } },
      { prefixId: "flow_point", dims: { flow_name: u("checkout"), flow_step: u("processing"), flow_variant: u("default") } },
      { prefixId: "permission", dims: { role: u("customer") } },
      { prefixId: "order_event", dims: { action: u("create") } }
    ]
  },
  {
    event_key: "payment.process",
    domain: "commerce",
    prefixes: [
      { prefixId: "tracking", dims: { trackAction: u("submit"), page: u("checkout"), userType: x("userType") } },
      { prefixId: "endpoint", dims: { resource_type: u("api"), http_method: u("POST"), api_version: u("v1") } },
      { prefixId: "flow_point", dims: { flow_name: u("payment"), flow_step: u("payment"), flow_variant: u("default") } },
      { prefixId: "pipeline_point", dims: { pipeline_phase: u("ingest"), validation_mode: u("strict"), verdict_result: u("pass"), temporal_strategy: u("span_local") } }
    ]
  },
  {
    event_key: "payment.success",
    domain: "commerce",
    prefixes: [
      { prefixId: "tracking", dims: { trackAction: u("purchase"), page: u("checkout"), userType: x("userType") } },
      { prefixId: "order_event", dims: { action: u("complete") } },
      { prefixId: "flow_point", dims: { flow_name: u("checkout"), flow_step: u("success"), flow_variant: u("default") } },
      { prefixId: "pipeline_point", dims: { pipeline_phase: u("verdict"), validation_mode: u("strict"), verdict_result: u("pass"), temporal_strategy: u("span_local") } }
    ]
  }
], Cr = /* @__PURE__ */ new Map();
function Ar(r) {
  for (const e of r)
    Cr.set(e.event_key, e);
}
Ar(Ir);
class qr {
  constructor(e) {
    w(this, "endpoint");
    this.endpoint = e;
  }
  async send(e) {
    const t = JSON.stringify(e);
    if (typeof navigator < "u" && navigator.sendBeacon) {
      const i = new Blob([t], { type: "application/json" });
      if (navigator.sendBeacon(this.endpoint, i)) return;
    }
    const n = await fetch(this.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: t,
      keepalive: !0
    });
    if (!n.ok)
      throw new Error(`[BeaconTransport] ${n.status} ${n.statusText}`);
  }
  async flush() {
  }
  async shutdown() {
  }
}
const Qe = "qa_monitor";
function De(r = Qe) {
  try {
    const t = sessionStorage.getItem(r);
    if (t) {
      const n = JSON.parse(t);
      if (n.sessionId && n.traceId)
        return { sessionId: n.sessionId, traceId: n.traceId };
    }
  } catch {
  }
  const e = {
    sessionId: or(),
    traceId: Ge()
  };
  try {
    sessionStorage.setItem(r, JSON.stringify(e));
  } catch {
  }
  return e;
}
function Er(r = Qe) {
  try {
    sessionStorage.removeItem(r);
  } catch {
  }
}
function Or(r, e) {
  const t = [];
  if (r.clicks) {
    const n = (i) => {
      var o;
      const a = i.target;
      if (!a) return;
      const s = a.closest("button, a, [data-qa-event]");
      s && e("click", {
        tag: s.tagName.toLowerCase(),
        text: ((o = s.textContent) == null ? void 0 : o.trim().slice(0, 100)) ?? "",
        qa_id: s.dataset.qaId ?? s.id ?? void 0,
        href: s instanceof HTMLAnchorElement ? s.href : void 0,
        qa_event: s.dataset.qaEvent ?? void 0
      });
    };
    document.addEventListener("click", n, !0), t.push(() => document.removeEventListener("click", n, !0));
  }
  if (r.forms) {
    const n = (i) => {
      const a = i.target;
      if (!a) return;
      const s = new FormData(a), o = [];
      s.forEach((c, d) => o.push(d)), e("form_submit", {
        form_id: a.id || void 0,
        form_action: a.action || void 0,
        field_count: o.length
      });
    };
    document.addEventListener("submit", n, !0), t.push(() => document.removeEventListener("submit", n, !0));
  }
  if (r.navigation) {
    const n = () => {
      e("page_view", { url: location.href, referrer: document.referrer });
    };
    window.addEventListener("popstate", n), t.push(() => window.removeEventListener("popstate", n));
    const i = history.pushState;
    history.pushState = function(...a) {
      i.call(history, ...a), e("page_view", { url: location.href });
    }, t.push(() => {
      history.pushState = i;
    });
  }
  return () => t.forEach((n) => n());
}
function Ye(r, e, t) {
  const n = r[e];
  if (!n)
    return null;
  const i = [], a = [];
  for (const c of n.labels) {
    const d = n.dims[c];
    if (!d)
      return null;
    if (d.kind === "axis") {
      i.push(d.capacity ?? d.entries.length);
      const h = d.entries.indexOf(t[c]);
      if (h < 0)
        return null;
      a.push(h);
    } else {
      const h = d.values;
      i.push(h.length);
      const I = t[c] ?? h[0], T = h.indexOf(I);
      a.push(T < 0 ? 0 : T);
    }
  }
  const s = new Array(i.length);
  s[i.length - 1] = 1;
  for (let c = i.length - 2; c >= 0; c--)
    s[c] = s[c + 1] * i[c + 1];
  let o = 0;
  for (let c = 0; c < a.length; c++)
    o += a[c] * s[c];
  return { prefix: e, version: n.version, address: o, serialized: `${e}:${n.version}:${o}` };
}
function Xe(r, e) {
  const t = e.split(":"), [n, i, a] = t.length === 4 ? [t[1], t[2], t[3]] : [t[0], t[1], t[2]], s = r[n];
  if (!s)
    return null;
  let o = parseInt(a);
  if (isNaN(o))
    return null;
  const c = [], d = [];
  for (const T of s.labels) {
    const q = s.dims[T];
    q && (q.kind === "axis" ? c.push(q.capacity ?? q.entries.length) : c.push(q.values.length), d.push({ label: T, dim: q }));
  }
  const h = new Array(c.length);
  h[c.length - 1] = 1;
  for (let T = c.length - 2; T >= 0; T--)
    h[T] = h[T + 1] * c[T + 1];
  const I = {};
  for (let T = 0; T < d.length; T++) {
    const q = Math.floor(o / h[T]);
    o %= h[T];
    const { label: tt, dim: pe } = d[T];
    I[tt] = pe.kind === "axis" ? pe.entries[q] ?? `(${q})` : pe.values[q] ?? q;
  }
  return { prefix: n, version: i, values: I };
}
function X(r, e) {
  const t = {};
  for (const [n, i] of Object.entries(e)) {
    const a = r[n];
    if (!a)
      continue;
    const s = { ...i };
    for (const c of a.labels) {
      const d = a.dims[c];
      (d == null ? void 0 : d.kind) === "prefix_ref" && !(c in s) && (s[c] = d.values[0]);
    }
    const o = Ye(r, n, s);
    o && (t[n] = o.serialized);
  }
  return t;
}
function Nr(r, e) {
  const t = {};
  for (const [n, i] of Object.entries(e)) {
    const a = Xe(r, i);
    a && (t[n] = { prefix: a.prefix, values: a.values });
  }
  return t;
}
const Rr = {
  // context
  service: "context",
  page_view: "context",
  // trigger
  tracking: "trigger",
  cart_event: "trigger",
  auth_event: "trigger",
  order_event: "trigger",
  event: "trigger",
  engine_event: "trigger",
  schema_event: "trigger",
  // channel
  endpoint: "channel",
  // state
  flow_point: "state",
  // guard
  permission: "guard",
  rbac: "guard",
  // effect
  pipeline_point: "effect",
  health_event: "effect",
  deploy_event: "effect",
  data_policy: "effect",
  // data
  members: "data",
  orders: "data",
  items: "data",
  orgs: "data",
  carts: "data",
  cart_items: "data",
  // relation
  relational: "context",
  content: "context"
};
function jr(r) {
  return Rr[r] ?? "trigger";
}
function Zr(r) {
  const e = {
    context: [],
    trigger: [],
    channel: [],
    state: [],
    guard: [],
    effect: [],
    data: []
  };
  for (const [t, n] of Object.entries(r)) {
    const i = jr(t);
    e[i].push({ prefixId: t, serialized: n });
  }
  return e;
}
function $r(r, e) {
  const t = X(r, e), n = Zr(t);
  return { addressContext: t, byRole: n };
}
const ee = {
  service: { version: "v1", labels: ["env", "region", "svc_name", "namespace"], dims: { env: { kind: "axis", entries: ["dev", "stage", "prod", "test", "local"], capacity: 32 }, region: { kind: "axis", entries: ["asia", "usa"], capacity: 32 }, svc_name: { kind: "axis", entries: ["shopping-web", "shopping-backend", "auth", "payment", "gateway", "registry-service", "ingest-server", "platform-demo", "content-service", "infra-controller", "gate-service", "query-service", "decode-service", "platform-demo-api"], capacity: 32 }, namespace: { kind: "axis", entries: ["shop", "cms"], capacity: 32 } } },
  permission: { version: "v4", labels: ["perm_svc", "role"], dims: { perm_svc: { kind: "prefix_ref", values: [65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, role: { kind: "axis", entries: ["admin", "developer", "operator", "viewer", "readonly", "customer", "auditor"], capacity: 32 } } },
  event: { version: "v4", labels: ["evt_svc", "event_name", "initiator"], dims: { evt_svc: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 65536, 65568, 65600, 65632, 65664] }, event_name: { kind: "axis", entries: ["user.login", "user.logout", "order.created", "order.paid", "payment.failed", "session.expired", "config.changed", "payment.cancel_requested", "payment.cancel_approved", "payment.refunded"], capacity: 64 }, initiator: { kind: "axis", entries: ["web", "mobile"], capacity: 32 } } },
  rbac: { version: "v1", labels: ["role", "action", "resource"], dims: { role: { kind: "axis", entries: ["admin", "editor", "viewer"], capacity: 32 }, action: { kind: "axis", entries: ["read", "write", "delete", "admin"], capacity: 32 }, resource: { kind: "axis", entries: ["dashboard", "reports", "settings", "users"], capacity: 32 } } },
  content: { version: "v1", labels: ["tag", "category", "status", "locale", "channel"], dims: { tag: { kind: "axis", entries: ["frontend", "backend", "devops", "ai", "database"], capacity: 32 }, category: { kind: "axis", entries: ["tech", "design", "product", "culture"], capacity: 32 }, status: { kind: "axis", entries: ["draft", "published", "archived"], capacity: 32 }, locale: { kind: "axis", entries: ["ko", "en", "ja"], capacity: 32 }, channel: { kind: "axis", entries: ["web", "mobile"], capacity: 32 } } },
  tracking: { version: "v3", labels: ["svc_ref", "trackAction", "page", "userType"], dims: { svc_ref: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 65536, 65568, 65600, 65632, 65664] }, trackAction: { kind: "axis", entries: ["click", "view", "scroll", "submit", "navigate", "add_to_cart", "purchase", "close"], capacity: 32 }, page: { kind: "axis", entries: ["home", "product_list", "product_detail", "cart", "checkout", "order_complete", "mypage", "login"], capacity: 32 }, userType: { kind: "axis", entries: ["guest", "member", "premium"], capacity: 32 } } },
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
  cart_event: { version: "v2", labels: ["svc_ref", "action"], dims: { svc_ref: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 65536, 65568, 65600, 65632, 65664] }, action: { kind: "axis", entries: ["add", "remove", "checkout"], capacity: 32 } } },
  auth_event: { version: "v2", labels: ["svc_ref", "action"], dims: { svc_ref: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 65536, 65568, 65600, 65632, 65664] }, action: { kind: "axis", entries: ["login", "logout", "token_refresh"], capacity: 32 } } },
  order_event: { version: "v1", labels: ["service_ctx", "action"], dims: { service_ctx: { kind: "prefix_ref", values: [65536, 65568, 65600, 65632, 65664] }, action: { kind: "axis", entries: ["create", "cancel", "refund", "complete"], capacity: 32 } } },
  build_event: { version: "v2", labels: ["qa_pkg", "qa_module", "build_result"], dims: { qa_pkg: { kind: "axis", entries: ["spec-core", "cli", "sdk", "demo-snapshot", "weighted-index", "bit-index", "permission-engine", "index-meta", "platform-demo", "ingest-server", "registry-service", "e2e"], capacity: 32 }, qa_module: { kind: "axis", entries: ["shared", "schema", "export-surface", "spec", "loader", "codegen", "dkg", "dkg-skills", "convergence", "propagation", "store", "visualization", "shopping-flow", "event-pipeline", "iframe-integration", "scenario-selector", "shop-ingest-integration", "anonymous-browse", "cart-abandon", "multi-product-purchase", "_all"], capacity: 64 }, build_result: { kind: "axis", entries: ["success", "failure", "type-error", "skipped"], capacity: 8 } } },
  test_event: { version: "v2", labels: ["qa_pkg", "qa_module", "test_result"], dims: { qa_pkg: { kind: "axis", entries: ["spec-core", "cli", "sdk", "demo-snapshot", "weighted-index", "bit-index", "permission-engine", "index-meta", "platform-demo", "ingest-server", "registry-service", "e2e"], capacity: 32 }, qa_module: { kind: "axis", entries: ["shared", "schema", "export-surface", "spec", "loader", "codegen", "dkg", "dkg-skills", "convergence", "propagation", "store", "visualization", "shopping-flow", "event-pipeline", "iframe-integration", "scenario-selector", "shop-ingest-integration", "anonymous-browse", "cart-abandon", "multi-product-purchase", "_all"], capacity: 64 }, test_result: { kind: "axis", entries: ["passed", "failed", "error", "skipped", "timeout"], capacity: 16 } } },
  dkg_event: { version: "v1", labels: ["dkg_op", "dkg_target_kind"], dims: { dkg_op: { kind: "axis", entries: ["claim", "release", "decide", "observe", "resolve", "link", "refresh", "self-check", "converge", "trace", "promote"], capacity: 32 }, dkg_target_kind: { kind: "axis", entries: ["axis", "prefix", "domain", "dsl-bundle", "decision", "observation", "constraint", "skill", "intent-link", "system"], capacity: 16 } } },
  dkg_decision_event: { version: "v1", labels: ["decision_type", "dkg_target_kind", "node_source"], dims: { decision_type: { kind: "axis", entries: ["capacity", "new-axis", "new-prefix", "dim-add", "merge", "deprecate", "separation"], capacity: 16 }, dkg_target_kind: { kind: "axis", entries: ["axis", "prefix", "domain", "dsl-bundle", "decision", "observation", "constraint", "skill", "intent-link", "system"], capacity: 16 }, node_source: { kind: "axis", entries: ["bootstrap", "manual", "auto"], capacity: 8 } } },
  dkg_observation_event: { version: "v1", labels: ["obs_source", "dkg_target_kind", "lifecycle_state"], dims: { obs_source: { kind: "axis", entries: ["manual", "metric", "runtime", "review"], capacity: 8 }, dkg_target_kind: { kind: "axis", entries: ["axis", "prefix", "domain", "dsl-bundle", "decision", "observation", "constraint", "skill", "intent-link", "system"], capacity: 16 }, lifecycle_state: { kind: "axis", entries: ["draft", "active", "deprecated", "archived", "superseded", "reversed"], capacity: 16 } } },
  skill_execution: { version: "v1", labels: ["skill_id", "skill_category", "skill_outcome"], dims: { skill_id: { kind: "axis", entries: ["skill-trace", "skill-explore-service", "skill-explore-prefix", "skill-explore-dsl", "skill-system-overview", "skill-record-decision", "skill-record-observation", "skill-claim", "skill-release", "skill-lifecycle-transition", "skill-checkout-flow-verify", "skill-commerce-skew-audit", "skill-observation-coverage", "skill-infra-impact-verify", "skill-pipeline-phase-verify", "skill-event-action-check", "skill-svc-binding-check", "skill-safe-entry-add", "skill-decision-scaffold", "skill-analyze-impact", "skill-infer-migrator", "skill-domain-health", "skill-pattern-analysis", "skill-schema-health-audit", "skill-entry-add-chain", "skill-system-health-chain", "skill-converge-chain", "skill-self-check-analyze", "skill-cli-coverage", "skill-promote-scan", "skill-spec-manage", "skill-registry-publish", "skill-flow-trace", "skill-table-impact"], capacity: 64 }, skill_category: { kind: "axis", entries: ["read", "write", "analysis", "chain"], capacity: 8 }, skill_outcome: { kind: "axis", entries: ["ok", "warning", "error", "blocked", "skipped"], capacity: 16 } } },
  cli_event: { version: "v1", labels: ["cli_intent", "cli_domain", "cli_subject"], dims: { cli_intent: { kind: "axis", entries: ["query", "analyze", "mutate", "publish", "lifecycle", "init", "backup"], capacity: 16 }, cli_domain: { kind: "axis", entries: ["dkg-graph", "dkg-skill", "convergence", "spec", "coordinate", "registry", "catalog", "self-ref", "system", "ingest"], capacity: 16 }, cli_subject: { kind: "axis", entries: ["axis", "prefix", "domain", "dsl-bundle", "decision", "observation", "constraint", "skill", "intent-link", "system", "version", "spec", "schema", "catalog", "service", "table"], capacity: 32 } } },
  contract_check: { version: "v1", labels: ["qa_pkg", "api_surface", "test_result"], dims: { qa_pkg: { kind: "axis", entries: ["spec-core", "cli", "sdk", "demo-snapshot", "weighted-index", "bit-index", "permission-engine", "index-meta", "platform-demo", "ingest-server", "registry-service", "e2e", "core", "engine", "store", "gate-service", "query-service", "decode-service", "registry-server", "registry-client", "apm", "browser-sdk", "event-catalog", "pino", "viz-3d", "viz-web", "demo-tests", "weighted-wasm"], capacity: 64 }, api_surface: { kind: "axis", entries: ["encode-decode", "stride-calc", "bitmask-ops", "dim-extract", "perm-grant", "protocol-codec", "state-lifecycle", "query-resolve", "schema-validate", "convergence-analysis", "dkg-graph", "integration"], capacity: 32 }, test_result: { kind: "axis", entries: ["passed", "failed", "error", "skipped", "timeout"], capacity: 16 } } },
  pattern_match: { version: "v1", labels: ["svc_ref", "identification_mode", "behavior_pattern", "pattern_confidence"], dims: { svc_ref: { kind: "prefix_ref", values: [65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, identification_mode: { kind: "axis", entries: ["anonymous", "identified", "pseudonymized", "service"], capacity: 8 }, behavior_pattern: { kind: "axis", entries: ["purchase_complete", "browse_only", "cart_abandon", "checkout_fail", "error_recovery", "return_visit", "anonymous_browse", "anonymous_cart", "api_integration", "bot_crawl", "health_check", "unclassified"], capacity: 32 }, pattern_confidence: { kind: "axis", entries: ["exact", "high", "medium", "low", "unknown"], capacity: 16 } } },
  pattern_anomaly: { version: "v2", labels: ["svc_ref", "anomaly_kind", "behavior_pattern", "anomaly_severity"], dims: { svc_ref: { kind: "prefix_ref", values: [65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, anomaly_kind: { kind: "axis", entries: ["unclassified", "ratio_shift", "volume_spike", "new_sequence", "abnormal_speed", "abnormal_duration"], capacity: 16 }, behavior_pattern: { kind: "axis", entries: ["purchase_complete", "browse_only", "cart_abandon", "checkout_fail", "error_recovery", "return_visit", "anonymous_browse", "anonymous_cart", "api_integration", "bot_crawl", "health_check", "unclassified"], capacity: 32 }, anomaly_severity: { kind: "axis", entries: ["info", "warning", "critical"], capacity: 8 } } },
  version_point: { version: "v1", labels: ["svc_ref", "version_lifecycle"], dims: { svc_ref: { kind: "prefix_ref", values: [65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, version_lifecycle: { kind: "axis", entries: ["draft", "locked", "released", "active", "deprecated"], capacity: 16 } } },
  gate_point: { version: "v1", labels: ["svc_ref", "address_state"], dims: { svc_ref: { kind: "prefix_ref", values: [65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, address_state: { kind: "axis", entries: ["active", "reserved", "inactive", "open"], capacity: 8 } } },
  observation_event: { version: "v1", labels: ["observation_intent", "dkg_target_kind"], dims: { observation_intent: { kind: "axis", entries: ["action_needed", "monitoring", "completed"], capacity: 8 }, dkg_target_kind: { kind: "axis", entries: ["axis", "prefix", "domain", "dsl-bundle", "decision", "observation", "constraint", "skill", "intent-link", "system"], capacity: 16 } } },
  spec_event: { version: "v1", labels: ["spec_type", "lifecycle_state"], dims: { spec_type: { kind: "axis", entries: ["req", "feat", "uc", "evt", "ls", "adr"], capacity: 16 }, lifecycle_state: { kind: "axis", entries: ["draft", "active", "deprecated", "archived", "superseded", "reversed"], capacity: 16 } } },
  edge_activity: { version: "v1", labels: ["edge_type", "dkg_target_kind"], dims: { edge_type: { kind: "axis", entries: ["satisfies", "implements", "tests", "traces-to", "depends-on", "composes", "references", "governs", "justifies", "constrains", "contains", "bridges", "consumes", "binds", "observes", "prompts", "evolves-from", "supersedes"], capacity: 32 }, dkg_target_kind: { kind: "axis", entries: ["axis", "prefix", "domain", "dsl-bundle", "decision", "observation", "constraint", "skill", "intent-link", "system"], capacity: 16 } } },
  execution_context: { version: "v1", labels: ["svc_ref", "execution_mode"], dims: { svc_ref: { kind: "prefix_ref", values: [65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, execution_mode: { kind: "axis", entries: ["live", "test", "synthetic", "replay"], capacity: 8 } } },
  ingest_record: { version: "v1", labels: ["svc_ref", "record_type"], dims: { svc_ref: { kind: "prefix_ref", values: [65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, record_type: { kind: "axis", entries: ["log", "span", "metric"], capacity: 8 } } },
  event_classification: { version: "v1", labels: ["svc_ref", "event_category", "event_lifecycle_stage"], dims: { svc_ref: { kind: "prefix_ref", values: [65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, event_category: { kind: "axis", entries: ["user_action", "system_action", "network_action", "data_action", "agent_action", "sdk_action", "error", "state_change"], capacity: 16 }, event_lifecycle_stage: { kind: "axis", entries: ["interaction", "request", "processing", "result", "side_effect", "completion"], capacity: 16 } } },
  metric_point: { version: "v1", labels: ["svc_ref", "metric_type", "record_type"], dims: { svc_ref: { kind: "prefix_ref", values: [65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, metric_type: { kind: "axis", entries: ["counter", "gauge", "histogram", "summary"], capacity: 8 }, record_type: { kind: "axis", entries: ["log", "span", "metric"], capacity: 8 } } }
};
async function Mr(r) {
  const e = (r == null ? void 0 : r.cacheKey) ?? "qa-sdk-catalog", t = (r == null ? void 0 : r.cacheTtlMs) ?? 300 * 1e3, n = (r == null ? void 0 : r.timeoutMs) ?? 5e3;
  if (r != null && r.registryUrl)
    try {
      const a = await Pr(r.registryUrl, n);
      if (a && Object.keys(a).length > 0)
        return zr(e, a), {
          catalog: a,
          source: "api",
          prefixCount: Object.keys(a).length,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        };
    } catch {
    }
  const i = Dr(e, t);
  return i ? {
    catalog: i,
    source: "cache",
    prefixCount: Object.keys(i).length,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  } : {
    catalog: ee,
    source: "static",
    prefixCount: Object.keys(ee).length,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function Pr(r, e) {
  const t = new AbortController(), n = setTimeout(() => t.abort(), e);
  try {
    const i = await fetch(`${r}/resolve/active`, { signal: t.signal });
    if (clearTimeout(n), !i.ok)
      return null;
    const a = await i.json();
    return Lr(a);
  } catch {
    return clearTimeout(n), null;
  }
}
function Lr(r) {
  var t;
  const e = {};
  for (const [n, i] of Object.entries(r)) {
    if (!i || typeof i != "object")
      continue;
    const a = i.version ?? i.activeVersion ?? "v1", s = i.labels ?? i.dims ? Object.keys(i.dims) : [], o = {};
    if (i.dims)
      for (const [c, d] of Object.entries(i.dims))
        d.kind === "axis" || d.entries ? o[c] = {
          kind: "axis",
          entries: d.entries ?? [],
          capacity: d.capacity ?? ((t = d.entries) == null ? void 0 : t.length) ?? 32
        } : (d.kind === "prefix_ref" || d.values) && (o[c] = {
          kind: "prefix_ref",
          values: d.values ?? []
        });
    (s.length > 0 || Object.keys(o).length > 0) && (e[n] = { version: a, labels: s, dims: o });
  }
  return e;
}
function zr(r, e) {
  try {
    const t = { catalog: e, savedAt: Date.now() };
    localStorage.setItem(r, JSON.stringify(t));
  } catch {
  }
}
function Dr(r, e) {
  try {
    const t = localStorage.getItem(r);
    if (!t)
      return null;
    const n = JSON.parse(t);
    return Date.now() - n.savedAt > e ? null : n.catalog;
  } catch {
    return null;
  }
}
const Vr = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  BROWSER_CATALOG: ee,
  decode: Xe,
  decodeContext: Nr,
  encode: Ye,
  loadCatalog: Mr,
  track: X,
  trackWithSignal: $r
}, Symbol.toStringTag, { value: "Module" }));
class et {
  constructor(e) {
    w(this, "logger");
    w(this, "session");
    w(this, "storageKey");
    w(this, "destroyAutoCapture", null);
    w(this, "unloadHandler");
    w(this, "_status", "active");
    var c, d;
    this.storageKey = e.storageKey ?? "qa_monitor", this.session = De(this.storageKey);
    const t = new qr(`${e.ingestUrl}/v1/ingest`), n = e.serviceConfig, i = n ? it(n, "@qa-sdk/browser", "0.1.0") : { service_name: ((c = e.meta) == null ? void 0 : c.serviceName) ?? "browser", sdk_name: "@qa-sdk/browser", sdk_version: "0.1.0" }, a = n ? at(n) : { env: ((d = e.meta) == null ? void 0 : d.env) ?? "production" };
    let s = e.infraContext;
    if (!s && n)
      try {
        const h = Ve(n);
        s = X(ee, { service: h });
      } catch {
      }
    this.logger = new _r({
      transport: t,
      owner: e.owner ?? { owner_type: "tenant", owner_id: "browser-monitor" },
      source: i,
      runtime: {
        platform: "browser",
        os_version: typeof navigator < "u" ? navigator.userAgent : "unknown"
      },
      build: a,
      flushIntervalMs: 5e3,
      onError: e.onError,
      ...s ? { infraContext: s } : {},
      ...e.entrySnapshot ? { entrySnapshot: e.entrySnapshot } : {}
    });
    const o = new ue({
      trace_id: this.session.traceId,
      qa_session_id: this.session.sessionId
    });
    this.logger.setContext(o), e.scenarioId && this.emit("session_start", { scenario_id: e.scenarioId }), e.autoCapture && (this.destroyAutoCapture = Or(e.autoCapture, (h, I) => {
      this.emit(h, I);
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
  // ── Actor 설정 ─────────────────────────────────────────
  /** 행위 주체 설정. 이후 모든 이벤트에 actor_id/user_id가 자동 포함. */
  setUser(e) {
    this.logger.setActor({
      actor_id: e.actorId,
      user_id: e.userId ?? e.actorId,
      identification_mode: "identified",
      user_attributes: e.attributes
    });
  }
  /** Actor 해제 (로그아웃). */
  clearUser() {
    this.logger.clearActor();
  }
  // ── 이벤트 발생 ─────────────────────────────────────────
  /**
   * 좌표 인코딩 + 이벤트 전송을 한 번에.
   *
   * track(BROWSER_CATALOG, prefixes) → emit(eventKey, payload, { address_context }) 조합.
   *
   * @example
   * monitor.emitWithCoords('page.home', {
   *   page_view: { page: 'home', locale: 'ko', userType: 'member' },
   *   tracking: { trackAction: 'view', page: 'home', userType: 'member' },
   * });
   */
  emitWithCoords(e, t, n) {
    let i;
    try {
      i = X(ee, t);
    } catch {
    }
    this.emit(e, n ?? { event: e }, i ? { address_context: i } : void 0);
  }
  /**
   * 수동 이벤트 발생.
   * event-catalog에 등록된 event_key면 버전을 자동으로 조회한다.
   * stopped 상태에서는 경고 후 무시된다.
   */
  emit(e, t, n) {
    if (this._status === "stopped") {
      console.warn(`[QaMonitor] emit("${e}") called after shutdown — event dropped`);
      return;
    }
    const i = wr(e), a = ((i == null ? void 0 : i.event_version) ?? "1").padStart(3, "0");
    this.logger.log({
      event_key: e,
      event_version: a,
      payload: t,
      ...n != null && n.address_context ? { address_context: n.address_context } : {}
    });
  }
  // ── 메트릭 ─────────────────────────────────────────────
  /**
   * 메트릭 이벤트 기록. QaLogger.metric() 위임.
   * stopped 상태에서는 경고 후 무시.
   */
  metric(e, t, n) {
    if (this._status === "stopped") {
      console.warn(`[QaMonitor] metric("${e}") called after shutdown — event dropped`);
      return;
    }
    this.logger.metric(e, t, {
      type: n == null ? void 0 : n.type,
      unit: n == null ? void 0 : n.unit,
      labels: n == null ? void 0 : n.labels,
      ...n != null && n.address_context ? { address_context: n.address_context } : {}
    });
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
    Er(this.storageKey);
    const e = De(this.storageKey), t = new ue({
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
function Fr(r) {
  return new et(r);
}
async function Wr(r) {
  if (r.registry)
    try {
      const { loadCatalog: e } = await Promise.resolve().then(() => Vr), t = await e({
        registryUrl: r.registry,
        cacheKey: `qa-catalog-${r.catalogId ?? "demo"}`
      });
      if (r.serviceConfig && !r.infraContext) {
        const n = Ve(r.serviceConfig);
        r = {
          ...r,
          infraContext: X(t.catalog, { service: n })
        };
      }
    } catch (e) {
      console.warn(`[QaMonitorAsync] registry fetch failed: ${e instanceof Error ? e.message : String(e)}. Using static BROWSER_CATALOG fallback.`);
    }
  return new et(r);
}
export {
  ee as BROWSER_CATALOG,
  qr as BeaconTransport,
  et as QaMonitor,
  Ur as buildEnvToCatalogEnv,
  ct as catalogEnvToBuildEnv,
  Fr as createQaMonitor,
  Wr as createQaMonitorAsync,
  Xe as decode,
  Nr as decodeContext,
  Ye as encode,
  _e as newLogId,
  or as newQaSessionId,
  sr as newSpanId,
  Ge as newTraceId,
  ar as newTransmissionId,
  Ve as toServiceDims,
  at as toTransmissionBuild,
  it as toTransmissionSource,
  X as track
};
//# sourceMappingURL=qa-browser-sdk.js.map
