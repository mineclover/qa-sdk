var Ye = Object.defineProperty;
var Xe = (r, e, t) => e in r ? Ye(r, e, { enumerable: !0, configurable: !0, writable: !0, value: t }) : r[e] = t;
var b = (r, e, t) => Xe(r, typeof e != "symbol" ? e + "" : e, t);
function Pe(r) {
  return {
    env: r.env,
    region: r.region,
    svc_name: r.name,
    namespace: r.namespace
  };
}
function et(r, e, t) {
  return {
    service_name: `${r.namespace}/${r.name}`,
    sdk_name: e,
    sdk_version: t
  };
}
function tt(r) {
  return {
    env: it(r.env),
    ...r.build != null ? { build_ref: r.build } : {},
    ...r.releaseVersion != null ? { release_version: r.releaseVersion } : {}
  };
}
const nt = {
  prod: "production",
  stage: "staging"
}, rt = {
  production: "prod",
  staging: "stage"
};
function it(r) {
  return nt[r] ?? r;
}
function In(r) {
  return rt[r] ?? r;
}
var k;
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
    const s = {};
    for (const a of i)
      s[a] = a;
    return s;
  }, r.getValidEnumValues = (i) => {
    const s = r.objectKeys(i).filter((o) => typeof i[i[o]] != "number"), a = {};
    for (const o of s)
      a[o] = i[o];
    return r.objectValues(a);
  }, r.objectValues = (i) => r.objectKeys(i).map(function(s) {
    return i[s];
  }), r.objectKeys = typeof Object.keys == "function" ? (i) => Object.keys(i) : (i) => {
    const s = [];
    for (const a in i)
      Object.prototype.hasOwnProperty.call(i, a) && s.push(a);
    return s;
  }, r.find = (i, s) => {
    for (const a of i)
      if (s(a))
        return a;
  }, r.isInteger = typeof Number.isInteger == "function" ? (i) => Number.isInteger(i) : (i) => typeof i == "number" && Number.isFinite(i) && Math.floor(i) === i;
  function n(i, s = " | ") {
    return i.map((a) => typeof a == "string" ? `'${a}'` : a).join(s);
  }
  r.joinValues = n, r.jsonStringifyReplacer = (i, s) => typeof s == "bigint" ? s.toString() : s;
})(k || (k = {}));
var we;
(function(r) {
  r.mergeShapes = (e, t) => ({
    ...e,
    ...t
    // second overwrites first
  });
})(we || (we = {}));
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
]), Z = (r) => {
  switch (typeof r) {
    case "undefined":
      return p.undefined;
    case "string":
      return p.string;
    case "number":
      return Number.isNaN(r) ? p.nan : p.number;
    case "boolean":
      return p.boolean;
    case "function":
      return p.function;
    case "bigint":
      return p.bigint;
    case "symbol":
      return p.symbol;
    case "object":
      return Array.isArray(r) ? p.array : r === null ? p.null : r.then && typeof r.then == "function" && r.catch && typeof r.catch == "function" ? p.promise : typeof Map < "u" && r instanceof Map ? p.map : typeof Set < "u" && r instanceof Set ? p.set : typeof Date < "u" && r instanceof Date ? p.date : p.object;
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
    super(), this.issues = [], this.addIssue = (n) => {
      this.issues = [...this.issues, n];
    }, this.addIssues = (n = []) => {
      this.issues = [...this.issues, ...n];
    };
    const t = new.target.prototype;
    Object.setPrototypeOf ? Object.setPrototypeOf(this, t) : this.__proto__ = t, this.name = "ZodError", this.issues = e;
  }
  format(e) {
    const t = e || function(s) {
      return s.message;
    }, n = { _errors: [] }, i = (s) => {
      for (const a of s.issues)
        if (a.code === "invalid_union")
          a.unionErrors.map(i);
        else if (a.code === "invalid_return_type")
          i(a.returnTypeError);
        else if (a.code === "invalid_arguments")
          i(a.argumentsError);
        else if (a.path.length === 0)
          n._errors.push(t(a));
        else {
          let o = n, c = 0;
          for (; c < a.path.length; ) {
            const d = a.path[c];
            c === a.path.length - 1 ? (o[d] = o[d] || { _errors: [] }, o[d]._errors.push(t(a))) : o[d] = o[d] || { _errors: [] }, o = o[d], c++;
          }
        }
    };
    return i(this), n;
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
    const t = {}, n = [];
    for (const i of this.issues)
      if (i.path.length > 0) {
        const s = i.path[0];
        t[s] = t[s] || [], t[s].push(e(i));
      } else
        n.push(e(i));
    return { formErrors: n, fieldErrors: t };
  }
  get formErrors() {
    return this.flatten();
  }
}
j.create = (r) => new j(r);
const ue = (r, e) => {
  let t;
  switch (r.code) {
    case l.invalid_type:
      r.received === p.undefined ? t = "Required" : t = `Expected ${r.expected}, received ${r.received}`;
      break;
    case l.invalid_literal:
      t = `Invalid literal value, expected ${JSON.stringify(r.expected, k.jsonStringifyReplacer)}`;
      break;
    case l.unrecognized_keys:
      t = `Unrecognized key(s) in object: ${k.joinValues(r.keys, ", ")}`;
      break;
    case l.invalid_union:
      t = "Invalid input";
      break;
    case l.invalid_union_discriminator:
      t = `Invalid discriminator value. Expected ${k.joinValues(r.options)}`;
      break;
    case l.invalid_enum_value:
      t = `Invalid enum value. Expected ${k.joinValues(r.options)}, received '${r.received}'`;
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
      typeof r.validation == "object" ? "includes" in r.validation ? (t = `Invalid input: must include "${r.validation.includes}"`, typeof r.validation.position == "number" && (t = `${t} at one or more positions greater than or equal to ${r.validation.position}`)) : "startsWith" in r.validation ? t = `Invalid input: must start with "${r.validation.startsWith}"` : "endsWith" in r.validation ? t = `Invalid input: must end with "${r.validation.endsWith}"` : k.assertNever(r.validation) : r.validation !== "regex" ? t = `Invalid ${r.validation}` : t = "Invalid";
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
      t = e.defaultError, k.assertNever(r);
  }
  return { message: t };
};
let st = ue;
function at() {
  return st;
}
const ot = (r) => {
  const { data: e, path: t, errorMaps: n, issueData: i } = r, s = [...t, ...i.path || []], a = {
    ...i,
    path: s
  };
  if (i.message !== void 0)
    return {
      ...i,
      path: s,
      message: i.message
    };
  let o = "";
  const c = n.filter((d) => !!d).slice().reverse();
  for (const d of c)
    o = d(a, { data: e, defaultError: o }).message;
  return {
    ...i,
    path: s,
    message: o
  };
};
function u(r, e) {
  const t = at(), n = ot({
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
      t === ue ? void 0 : ue
      // then global default map
    ].filter((i) => !!i)
  });
  r.common.issues.push(n);
}
class T {
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
        return g;
      i.status === "dirty" && e.dirty(), n.push(i.value);
    }
    return { status: e.value, value: n };
  }
  static async mergeObjectAsync(e, t) {
    const n = [];
    for (const i of t) {
      const s = await i.key, a = await i.value;
      n.push({
        key: s,
        value: a
      });
    }
    return T.mergeObjectSync(e, n);
  }
  static mergeObjectSync(e, t) {
    const n = {};
    for (const i of t) {
      const { key: s, value: a } = i;
      if (s.status === "aborted" || a.status === "aborted")
        return g;
      s.status === "dirty" && e.dirty(), a.status === "dirty" && e.dirty(), s.value !== "__proto__" && (typeof a.value < "u" || i.alwaysSet) && (n[s.value] = a.value);
    }
    return { status: e.value, value: n };
  }
}
const g = Object.freeze({
  status: "aborted"
}), H = (r) => ({ status: "dirty", value: r }), C = (r) => ({ status: "valid", value: r }), Se = (r) => r.status === "aborted", Te = (r) => r.status === "dirty", V = (r) => r.status === "valid", te = (r) => typeof Promise < "u" && r instanceof Promise;
var f;
(function(r) {
  r.errToObj = (e) => typeof e == "string" ? { message: e } : e || {}, r.toString = (e) => typeof e == "string" ? e : e == null ? void 0 : e.message;
})(f || (f = {}));
class O {
  constructor(e, t, n, i) {
    this._cachedPath = [], this.parent = e, this.data = t, this._path = n, this._key = i;
  }
  get path() {
    return this._cachedPath.length || (Array.isArray(this._key) ? this._cachedPath.push(...this._path, ...this._key) : this._cachedPath.push(...this._path, this._key)), this._cachedPath;
  }
}
const Ce = (r, e) => {
  if (V(e))
    return { success: !0, data: e.value };
  if (!r.common.issues.length)
    throw new Error("Validation failed but no issues detected.");
  return {
    success: !1,
    get error() {
      if (this._error)
        return this._error;
      const t = new j(r.common.issues);
      return this._error = t, this._error;
    }
  };
};
function y(r) {
  if (!r)
    return {};
  const { errorMap: e, invalid_type_error: t, required_error: n, description: i } = r;
  if (e && (t || n))
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  return e ? { errorMap: e, description: i } : { errorMap: (a, o) => {
    const { message: c } = r;
    return a.code === "invalid_enum_value" ? { message: c ?? o.defaultError } : typeof o.data > "u" ? { message: c ?? n ?? o.defaultError } : a.code !== "invalid_type" ? { message: o.defaultError } : { message: c ?? t ?? o.defaultError };
  }, description: i };
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
      status: new T(),
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
      parsedType: Z(e)
    }, i = this._parseSync({ data: e, path: n.path, parent: n });
    return Ce(n, i);
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
      parsedType: Z(e)
    };
    if (!this["~standard"].async)
      try {
        const s = this._parseSync({ data: e, path: [], parent: t });
        return V(s) ? {
          value: s.value
        } : {
          issues: t.common.issues
        };
      } catch (s) {
        (i = (n = s == null ? void 0 : s.message) == null ? void 0 : n.toLowerCase()) != null && i.includes("encountered") && (this["~standard"].async = !0), t.common = {
          issues: [],
          async: !0
        };
      }
    return this._parseAsync({ data: e, path: [], parent: t }).then((s) => V(s) ? {
      value: s.value
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
      parsedType: Z(e)
    }, i = this._parse({ data: e, path: n.path, parent: n }), s = await (te(i) ? i : Promise.resolve(i));
    return Ce(n, s);
  }
  refine(e, t) {
    const n = (i) => typeof t == "string" || typeof t > "u" ? { message: t } : typeof t == "function" ? t(i) : t;
    return this._refinement((i, s) => {
      const a = e(i), o = () => s.addIssue({
        code: l.custom,
        ...n(i)
      });
      return typeof Promise < "u" && a instanceof Promise ? a.then((c) => c ? !0 : (o(), !1)) : a ? !0 : (o(), !1);
    });
  }
  refinement(e, t) {
    return this._refinement((n, i) => e(n) ? !0 : (i.addIssue(typeof t == "function" ? t(n, i) : t), !1));
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
    return F.create(this, this._def);
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
    return ie.create(this, e, this._def);
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
    return new At({
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
    return ve.create(this, e);
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
const lt = /^c[^\s-]{8,}$/i, ct = /^[0-9a-z]+$/, dt = /^[0-9A-HJKMNP-TV-Z]{26}$/i, ut = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i, pt = /^[a-z0-9_-]{21}$/i, ft = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/, ht = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/, _t = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i, mt = "^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$";
let ce;
const gt = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/, yt = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/, vt = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/, kt = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/, bt = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/, xt = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/, De = "((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))", wt = new RegExp(`^${De}$`);
function Ve(r) {
  let e = "[0-5]\\d";
  r.precision ? e = `${e}\\.\\d{${r.precision}}` : r.precision == null && (e = `${e}(\\.\\d+)?`);
  const t = r.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${e})${t}`;
}
function St(r) {
  return new RegExp(`^${Ve(r)}$`);
}
function Tt(r) {
  let e = `${De}T${Ve(r)}`;
  const t = [];
  return t.push(r.local ? "Z?" : "Z"), r.offset && t.push("([+-]\\d{2}:?\\d{2})"), e = `${e}(${t.join("|")})`, new RegExp(`^${e}$`);
}
function Ct(r, e) {
  return !!((e === "v4" || !e) && gt.test(r) || (e === "v6" || !e) && vt.test(r));
}
function qt(r, e) {
  if (!ft.test(r))
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
function Et(r, e) {
  return !!((e === "v4" || !e) && yt.test(r) || (e === "v6" || !e) && kt.test(r));
}
class R extends v {
  _parse(e) {
    if (this._def.coerce && (e.data = String(e.data)), this._getType(e) !== p.string) {
      const s = this._getOrReturnCtx(e);
      return u(s, {
        code: l.invalid_type,
        expected: p.string,
        received: s.parsedType
      }), g;
    }
    const n = new T();
    let i;
    for (const s of this._def.checks)
      if (s.kind === "min")
        e.data.length < s.value && (i = this._getOrReturnCtx(e, i), u(i, {
          code: l.too_small,
          minimum: s.value,
          type: "string",
          inclusive: !0,
          exact: !1,
          message: s.message
        }), n.dirty());
      else if (s.kind === "max")
        e.data.length > s.value && (i = this._getOrReturnCtx(e, i), u(i, {
          code: l.too_big,
          maximum: s.value,
          type: "string",
          inclusive: !0,
          exact: !1,
          message: s.message
        }), n.dirty());
      else if (s.kind === "length") {
        const a = e.data.length > s.value, o = e.data.length < s.value;
        (a || o) && (i = this._getOrReturnCtx(e, i), a ? u(i, {
          code: l.too_big,
          maximum: s.value,
          type: "string",
          inclusive: !0,
          exact: !0,
          message: s.message
        }) : o && u(i, {
          code: l.too_small,
          minimum: s.value,
          type: "string",
          inclusive: !0,
          exact: !0,
          message: s.message
        }), n.dirty());
      } else if (s.kind === "email")
        _t.test(e.data) || (i = this._getOrReturnCtx(e, i), u(i, {
          validation: "email",
          code: l.invalid_string,
          message: s.message
        }), n.dirty());
      else if (s.kind === "emoji")
        ce || (ce = new RegExp(mt, "u")), ce.test(e.data) || (i = this._getOrReturnCtx(e, i), u(i, {
          validation: "emoji",
          code: l.invalid_string,
          message: s.message
        }), n.dirty());
      else if (s.kind === "uuid")
        ut.test(e.data) || (i = this._getOrReturnCtx(e, i), u(i, {
          validation: "uuid",
          code: l.invalid_string,
          message: s.message
        }), n.dirty());
      else if (s.kind === "nanoid")
        pt.test(e.data) || (i = this._getOrReturnCtx(e, i), u(i, {
          validation: "nanoid",
          code: l.invalid_string,
          message: s.message
        }), n.dirty());
      else if (s.kind === "cuid")
        lt.test(e.data) || (i = this._getOrReturnCtx(e, i), u(i, {
          validation: "cuid",
          code: l.invalid_string,
          message: s.message
        }), n.dirty());
      else if (s.kind === "cuid2")
        ct.test(e.data) || (i = this._getOrReturnCtx(e, i), u(i, {
          validation: "cuid2",
          code: l.invalid_string,
          message: s.message
        }), n.dirty());
      else if (s.kind === "ulid")
        dt.test(e.data) || (i = this._getOrReturnCtx(e, i), u(i, {
          validation: "ulid",
          code: l.invalid_string,
          message: s.message
        }), n.dirty());
      else if (s.kind === "url")
        try {
          new URL(e.data);
        } catch {
          i = this._getOrReturnCtx(e, i), u(i, {
            validation: "url",
            code: l.invalid_string,
            message: s.message
          }), n.dirty();
        }
      else s.kind === "regex" ? (s.regex.lastIndex = 0, s.regex.test(e.data) || (i = this._getOrReturnCtx(e, i), u(i, {
        validation: "regex",
        code: l.invalid_string,
        message: s.message
      }), n.dirty())) : s.kind === "trim" ? e.data = e.data.trim() : s.kind === "includes" ? e.data.includes(s.value, s.position) || (i = this._getOrReturnCtx(e, i), u(i, {
        code: l.invalid_string,
        validation: { includes: s.value, position: s.position },
        message: s.message
      }), n.dirty()) : s.kind === "toLowerCase" ? e.data = e.data.toLowerCase() : s.kind === "toUpperCase" ? e.data = e.data.toUpperCase() : s.kind === "startsWith" ? e.data.startsWith(s.value) || (i = this._getOrReturnCtx(e, i), u(i, {
        code: l.invalid_string,
        validation: { startsWith: s.value },
        message: s.message
      }), n.dirty()) : s.kind === "endsWith" ? e.data.endsWith(s.value) || (i = this._getOrReturnCtx(e, i), u(i, {
        code: l.invalid_string,
        validation: { endsWith: s.value },
        message: s.message
      }), n.dirty()) : s.kind === "datetime" ? Tt(s).test(e.data) || (i = this._getOrReturnCtx(e, i), u(i, {
        code: l.invalid_string,
        validation: "datetime",
        message: s.message
      }), n.dirty()) : s.kind === "date" ? wt.test(e.data) || (i = this._getOrReturnCtx(e, i), u(i, {
        code: l.invalid_string,
        validation: "date",
        message: s.message
      }), n.dirty()) : s.kind === "time" ? St(s).test(e.data) || (i = this._getOrReturnCtx(e, i), u(i, {
        code: l.invalid_string,
        validation: "time",
        message: s.message
      }), n.dirty()) : s.kind === "duration" ? ht.test(e.data) || (i = this._getOrReturnCtx(e, i), u(i, {
        validation: "duration",
        code: l.invalid_string,
        message: s.message
      }), n.dirty()) : s.kind === "ip" ? Ct(e.data, s.version) || (i = this._getOrReturnCtx(e, i), u(i, {
        validation: "ip",
        code: l.invalid_string,
        message: s.message
      }), n.dirty()) : s.kind === "jwt" ? qt(e.data, s.alg) || (i = this._getOrReturnCtx(e, i), u(i, {
        validation: "jwt",
        code: l.invalid_string,
        message: s.message
      }), n.dirty()) : s.kind === "cidr" ? Et(e.data, s.version) || (i = this._getOrReturnCtx(e, i), u(i, {
        validation: "cidr",
        code: l.invalid_string,
        message: s.message
      }), n.dirty()) : s.kind === "base64" ? bt.test(e.data) || (i = this._getOrReturnCtx(e, i), u(i, {
        validation: "base64",
        code: l.invalid_string,
        message: s.message
      }), n.dirty()) : s.kind === "base64url" ? xt.test(e.data) || (i = this._getOrReturnCtx(e, i), u(i, {
        validation: "base64url",
        code: l.invalid_string,
        message: s.message
      }), n.dirty()) : k.assertNever(s);
    return { status: n.value, value: e.data };
  }
  _regex(e, t, n) {
    return this.refinement((i) => e.test(i), {
      validation: t,
      code: l.invalid_string,
      ...f.errToObj(n)
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
R.create = (r) => new R({
  checks: [],
  typeName: m.ZodString,
  coerce: (r == null ? void 0 : r.coerce) ?? !1,
  ...y(r)
});
function It(r, e) {
  const t = (r.toString().split(".")[1] || "").length, n = (e.toString().split(".")[1] || "").length, i = t > n ? t : n, s = Number.parseInt(r.toFixed(i).replace(".", "")), a = Number.parseInt(e.toFixed(i).replace(".", ""));
  return s % a / 10 ** i;
}
class B extends v {
  constructor() {
    super(...arguments), this.min = this.gte, this.max = this.lte, this.step = this.multipleOf;
  }
  _parse(e) {
    if (this._def.coerce && (e.data = Number(e.data)), this._getType(e) !== p.number) {
      const s = this._getOrReturnCtx(e);
      return u(s, {
        code: l.invalid_type,
        expected: p.number,
        received: s.parsedType
      }), g;
    }
    let n;
    const i = new T();
    for (const s of this._def.checks)
      s.kind === "int" ? k.isInteger(e.data) || (n = this._getOrReturnCtx(e, n), u(n, {
        code: l.invalid_type,
        expected: "integer",
        received: "float",
        message: s.message
      }), i.dirty()) : s.kind === "min" ? (s.inclusive ? e.data < s.value : e.data <= s.value) && (n = this._getOrReturnCtx(e, n), u(n, {
        code: l.too_small,
        minimum: s.value,
        type: "number",
        inclusive: s.inclusive,
        exact: !1,
        message: s.message
      }), i.dirty()) : s.kind === "max" ? (s.inclusive ? e.data > s.value : e.data >= s.value) && (n = this._getOrReturnCtx(e, n), u(n, {
        code: l.too_big,
        maximum: s.value,
        type: "number",
        inclusive: s.inclusive,
        exact: !1,
        message: s.message
      }), i.dirty()) : s.kind === "multipleOf" ? It(e.data, s.value) !== 0 && (n = this._getOrReturnCtx(e, n), u(n, {
        code: l.not_multiple_of,
        multipleOf: s.value,
        message: s.message
      }), i.dirty()) : s.kind === "finite" ? Number.isFinite(e.data) || (n = this._getOrReturnCtx(e, n), u(n, {
        code: l.not_finite,
        message: s.message
      }), i.dirty()) : k.assertNever(s);
    return { status: i.value, value: e.data };
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
  setLimit(e, t, n, i) {
    return new B({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind: e,
          value: t,
          inclusive: n,
          message: f.toString(i)
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
    for (const n of this._def.checks) {
      if (n.kind === "finite" || n.kind === "int" || n.kind === "multipleOf")
        return !0;
      n.kind === "min" ? (t === null || n.value > t) && (t = n.value) : n.kind === "max" && (e === null || n.value < e) && (e = n.value);
    }
    return Number.isFinite(t) && Number.isFinite(e);
  }
}
B.create = (r) => new B({
  checks: [],
  typeName: m.ZodNumber,
  coerce: (r == null ? void 0 : r.coerce) || !1,
  ...y(r)
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
    let n;
    const i = new T();
    for (const s of this._def.checks)
      s.kind === "min" ? (s.inclusive ? e.data < s.value : e.data <= s.value) && (n = this._getOrReturnCtx(e, n), u(n, {
        code: l.too_small,
        type: "bigint",
        minimum: s.value,
        inclusive: s.inclusive,
        message: s.message
      }), i.dirty()) : s.kind === "max" ? (s.inclusive ? e.data > s.value : e.data >= s.value) && (n = this._getOrReturnCtx(e, n), u(n, {
        code: l.too_big,
        type: "bigint",
        maximum: s.value,
        inclusive: s.inclusive,
        message: s.message
      }), i.dirty()) : s.kind === "multipleOf" ? e.data % s.value !== BigInt(0) && (n = this._getOrReturnCtx(e, n), u(n, {
        code: l.not_multiple_of,
        multipleOf: s.value,
        message: s.message
      }), i.dirty()) : k.assertNever(s);
    return { status: i.value, value: e.data };
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
  setLimit(e, t, n, i) {
    return new G({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind: e,
          value: t,
          inclusive: n,
          message: f.toString(i)
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
G.create = (r) => new G({
  checks: [],
  typeName: m.ZodBigInt,
  coerce: (r == null ? void 0 : r.coerce) ?? !1,
  ...y(r)
});
class pe extends v {
  _parse(e) {
    if (this._def.coerce && (e.data = !!e.data), this._getType(e) !== p.boolean) {
      const n = this._getOrReturnCtx(e);
      return u(n, {
        code: l.invalid_type,
        expected: p.boolean,
        received: n.parsedType
      }), g;
    }
    return C(e.data);
  }
}
pe.create = (r) => new pe({
  typeName: m.ZodBoolean,
  coerce: (r == null ? void 0 : r.coerce) || !1,
  ...y(r)
});
class ne extends v {
  _parse(e) {
    if (this._def.coerce && (e.data = new Date(e.data)), this._getType(e) !== p.date) {
      const s = this._getOrReturnCtx(e);
      return u(s, {
        code: l.invalid_type,
        expected: p.date,
        received: s.parsedType
      }), g;
    }
    if (Number.isNaN(e.data.getTime())) {
      const s = this._getOrReturnCtx(e);
      return u(s, {
        code: l.invalid_date
      }), g;
    }
    const n = new T();
    let i;
    for (const s of this._def.checks)
      s.kind === "min" ? e.data.getTime() < s.value && (i = this._getOrReturnCtx(e, i), u(i, {
        code: l.too_small,
        message: s.message,
        inclusive: !0,
        exact: !1,
        minimum: s.value,
        type: "date"
      }), n.dirty()) : s.kind === "max" ? e.data.getTime() > s.value && (i = this._getOrReturnCtx(e, i), u(i, {
        code: l.too_big,
        message: s.message,
        inclusive: !0,
        exact: !1,
        maximum: s.value,
        type: "date"
      }), n.dirty()) : k.assertNever(s);
    return {
      status: n.value,
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
ne.create = (r) => new ne({
  checks: [],
  coerce: (r == null ? void 0 : r.coerce) || !1,
  typeName: m.ZodDate,
  ...y(r)
});
class qe extends v {
  _parse(e) {
    if (this._getType(e) !== p.symbol) {
      const n = this._getOrReturnCtx(e);
      return u(n, {
        code: l.invalid_type,
        expected: p.symbol,
        received: n.parsedType
      }), g;
    }
    return C(e.data);
  }
}
qe.create = (r) => new qe({
  typeName: m.ZodSymbol,
  ...y(r)
});
class Ee extends v {
  _parse(e) {
    if (this._getType(e) !== p.undefined) {
      const n = this._getOrReturnCtx(e);
      return u(n, {
        code: l.invalid_type,
        expected: p.undefined,
        received: n.parsedType
      }), g;
    }
    return C(e.data);
  }
}
Ee.create = (r) => new Ee({
  typeName: m.ZodUndefined,
  ...y(r)
});
class Ie extends v {
  _parse(e) {
    if (this._getType(e) !== p.null) {
      const n = this._getOrReturnCtx(e);
      return u(n, {
        code: l.invalid_type,
        expected: p.null,
        received: n.parsedType
      }), g;
    }
    return C(e.data);
  }
}
Ie.create = (r) => new Ie({
  typeName: m.ZodNull,
  ...y(r)
});
class Ae extends v {
  constructor() {
    super(...arguments), this._any = !0;
  }
  _parse(e) {
    return C(e.data);
  }
}
Ae.create = (r) => new Ae({
  typeName: m.ZodAny,
  ...y(r)
});
class fe extends v {
  constructor() {
    super(...arguments), this._unknown = !0;
  }
  _parse(e) {
    return C(e.data);
  }
}
fe.create = (r) => new fe({
  typeName: m.ZodUnknown,
  ...y(r)
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
M.create = (r) => new M({
  typeName: m.ZodNever,
  ...y(r)
});
class Oe extends v {
  _parse(e) {
    if (this._getType(e) !== p.undefined) {
      const n = this._getOrReturnCtx(e);
      return u(n, {
        code: l.invalid_type,
        expected: p.void,
        received: n.parsedType
      }), g;
    }
    return C(e.data);
  }
}
Oe.create = (r) => new Oe({
  typeName: m.ZodVoid,
  ...y(r)
});
class I extends v {
  _parse(e) {
    const { ctx: t, status: n } = this._processInputParams(e), i = this._def;
    if (t.parsedType !== p.array)
      return u(t, {
        code: l.invalid_type,
        expected: p.array,
        received: t.parsedType
      }), g;
    if (i.exactLength !== null) {
      const a = t.data.length > i.exactLength.value, o = t.data.length < i.exactLength.value;
      (a || o) && (u(t, {
        code: a ? l.too_big : l.too_small,
        minimum: o ? i.exactLength.value : void 0,
        maximum: a ? i.exactLength.value : void 0,
        type: "array",
        inclusive: !0,
        exact: !0,
        message: i.exactLength.message
      }), n.dirty());
    }
    if (i.minLength !== null && t.data.length < i.minLength.value && (u(t, {
      code: l.too_small,
      minimum: i.minLength.value,
      type: "array",
      inclusive: !0,
      exact: !1,
      message: i.minLength.message
    }), n.dirty()), i.maxLength !== null && t.data.length > i.maxLength.value && (u(t, {
      code: l.too_big,
      maximum: i.maxLength.value,
      type: "array",
      inclusive: !0,
      exact: !1,
      message: i.maxLength.message
    }), n.dirty()), t.common.async)
      return Promise.all([...t.data].map((a, o) => i.type._parseAsync(new O(t, a, t.path, o)))).then((a) => T.mergeArray(n, a));
    const s = [...t.data].map((a, o) => i.type._parseSync(new O(t, a, t.path, o)));
    return T.mergeArray(n, s);
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
I.create = (r, e) => new I({
  type: r,
  minLength: null,
  maxLength: null,
  exactLength: null,
  typeName: m.ZodArray,
  ...y(e)
});
function D(r) {
  if (r instanceof x) {
    const e = {};
    for (const t in r.shape) {
      const n = r.shape[t];
      e[t] = $.create(D(n));
    }
    return new x({
      ...r._def,
      shape: () => e
    });
  } else return r instanceof I ? new I({
    ...r._def,
    type: D(r.element)
  }) : r instanceof $ ? $.create(D(r.unwrap())) : r instanceof F ? F.create(D(r.unwrap())) : r instanceof L ? L.create(r.items.map((e) => D(e))) : r;
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
    const { status: n, ctx: i } = this._processInputParams(e), { shape: s, keys: a } = this._getCached(), o = [];
    if (!(this._def.catchall instanceof M && this._def.unknownKeys === "strip"))
      for (const d in i.data)
        a.includes(d) || o.push(d);
    const c = [];
    for (const d of a) {
      const h = s[d], S = i.data[d];
      c.push({
        key: { status: "valid", value: d },
        value: h._parse(new O(i, S, i.path, d)),
        alwaysSet: d in i.data
      });
    }
    if (this._def.catchall instanceof M) {
      const d = this._def.unknownKeys;
      if (d === "passthrough")
        for (const h of o)
          c.push({
            key: { status: "valid", value: h },
            value: { status: "valid", value: i.data[h] }
          });
      else if (d === "strict")
        o.length > 0 && (u(i, {
          code: l.unrecognized_keys,
          keys: o
        }), n.dirty());
      else if (d !== "strip") throw new Error("Internal ZodObject error: invalid unknownKeys value.");
    } else {
      const d = this._def.catchall;
      for (const h of o) {
        const S = i.data[h];
        c.push({
          key: { status: "valid", value: h },
          value: d._parse(
            new O(i, S, i.path, h)
            //, ctx.child(key), value, getParsedType(value)
          ),
          alwaysSet: h in i.data
        });
      }
    }
    return i.common.async ? Promise.resolve().then(async () => {
      const d = [];
      for (const h of c) {
        const S = await h.key, w = await h.value;
        d.push({
          key: S,
          value: w,
          alwaysSet: h.alwaysSet
        });
      }
      return d;
    }).then((d) => T.mergeObjectSync(n, d)) : T.mergeObjectSync(n, c);
  }
  get shape() {
    return this._def.shape();
  }
  strict(e) {
    return f.errToObj, new x({
      ...this._def,
      unknownKeys: "strict",
      ...e !== void 0 ? {
        errorMap: (t, n) => {
          var s, a;
          const i = ((a = (s = this._def).errorMap) == null ? void 0 : a.call(s, t, n).message) ?? n.defaultError;
          return t.code === "unrecognized_keys" ? {
            message: f.errToObj(e).message ?? i
          } : {
            message: i
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
    for (const n of k.objectKeys(e))
      e[n] && this.shape[n] && (t[n] = this.shape[n]);
    return new x({
      ...this._def,
      shape: () => t
    });
  }
  omit(e) {
    const t = {};
    for (const n of k.objectKeys(this.shape))
      e[n] || (t[n] = this.shape[n]);
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
    for (const n of k.objectKeys(this.shape)) {
      const i = this.shape[n];
      e && !e[n] ? t[n] = i : t[n] = i.optional();
    }
    return new x({
      ...this._def,
      shape: () => t
    });
  }
  required(e) {
    const t = {};
    for (const n of k.objectKeys(this.shape))
      if (e && !e[n])
        t[n] = this.shape[n];
      else {
        let s = this.shape[n];
        for (; s instanceof $; )
          s = s._def.innerType;
        t[n] = s;
      }
    return new x({
      ...this._def,
      shape: () => t
    });
  }
  keyof() {
    return Be(k.objectKeys(this.shape));
  }
}
x.create = (r, e) => new x({
  shape: () => r,
  unknownKeys: "strip",
  catchall: M.create(),
  typeName: m.ZodObject,
  ...y(e)
});
x.strictCreate = (r, e) => new x({
  shape: () => r,
  unknownKeys: "strict",
  catchall: M.create(),
  typeName: m.ZodObject,
  ...y(e)
});
x.lazycreate = (r, e) => new x({
  shape: r,
  unknownKeys: "strip",
  catchall: M.create(),
  typeName: m.ZodObject,
  ...y(e)
});
class re extends v {
  _parse(e) {
    const { ctx: t } = this._processInputParams(e), n = this._def.options;
    function i(s) {
      for (const o of s)
        if (o.result.status === "valid")
          return o.result;
      for (const o of s)
        if (o.result.status === "dirty")
          return t.common.issues.push(...o.ctx.common.issues), o.result;
      const a = s.map((o) => new j(o.ctx.common.issues));
      return u(t, {
        code: l.invalid_union,
        unionErrors: a
      }), g;
    }
    if (t.common.async)
      return Promise.all(n.map(async (s) => {
        const a = {
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
            parent: a
          }),
          ctx: a
        };
      })).then(i);
    {
      let s;
      const a = [];
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
        h.status === "dirty" && !s && (s = { result: h, ctx: d }), d.common.issues.length && a.push(d.common.issues);
      }
      if (s)
        return t.common.issues.push(...s.ctx.common.issues), s.result;
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
re.create = (r, e) => new re({
  options: r,
  typeName: m.ZodUnion,
  ...y(e)
});
function he(r, e) {
  const t = Z(r), n = Z(e);
  if (r === e)
    return { valid: !0, data: r };
  if (t === p.object && n === p.object) {
    const i = k.objectKeys(e), s = k.objectKeys(r).filter((o) => i.indexOf(o) !== -1), a = { ...r, ...e };
    for (const o of s) {
      const c = he(r[o], e[o]);
      if (!c.valid)
        return { valid: !1 };
      a[o] = c.data;
    }
    return { valid: !0, data: a };
  } else if (t === p.array && n === p.array) {
    if (r.length !== e.length)
      return { valid: !1 };
    const i = [];
    for (let s = 0; s < r.length; s++) {
      const a = r[s], o = e[s], c = he(a, o);
      if (!c.valid)
        return { valid: !1 };
      i.push(c.data);
    }
    return { valid: !0, data: i };
  } else return t === p.date && n === p.date && +r == +e ? { valid: !0, data: r } : { valid: !1 };
}
class ie extends v {
  _parse(e) {
    const { status: t, ctx: n } = this._processInputParams(e), i = (s, a) => {
      if (Se(s) || Se(a))
        return g;
      const o = he(s.value, a.value);
      return o.valid ? ((Te(s) || Te(a)) && t.dirty(), { status: t.value, value: o.data }) : (u(n, {
        code: l.invalid_intersection_types
      }), g);
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
    ]).then(([s, a]) => i(s, a)) : i(this._def.left._parseSync({
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
ie.create = (r, e, t) => new ie({
  left: r,
  right: e,
  typeName: m.ZodIntersection,
  ...y(t)
});
class L extends v {
  _parse(e) {
    const { status: t, ctx: n } = this._processInputParams(e);
    if (n.parsedType !== p.array)
      return u(n, {
        code: l.invalid_type,
        expected: p.array,
        received: n.parsedType
      }), g;
    if (n.data.length < this._def.items.length)
      return u(n, {
        code: l.too_small,
        minimum: this._def.items.length,
        inclusive: !0,
        exact: !1,
        type: "array"
      }), g;
    !this._def.rest && n.data.length > this._def.items.length && (u(n, {
      code: l.too_big,
      maximum: this._def.items.length,
      inclusive: !0,
      exact: !1,
      type: "array"
    }), t.dirty());
    const s = [...n.data].map((a, o) => {
      const c = this._def.items[o] || this._def.rest;
      return c ? c._parse(new O(n, a, n.path, o)) : null;
    }).filter((a) => !!a);
    return n.common.async ? Promise.all(s).then((a) => T.mergeArray(t, a)) : T.mergeArray(t, s);
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
L.create = (r, e) => {
  if (!Array.isArray(r))
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  return new L({
    items: r,
    typeName: m.ZodTuple,
    rest: null,
    ...y(e)
  });
};
class se extends v {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(e) {
    const { status: t, ctx: n } = this._processInputParams(e);
    if (n.parsedType !== p.object)
      return u(n, {
        code: l.invalid_type,
        expected: p.object,
        received: n.parsedType
      }), g;
    const i = [], s = this._def.keyType, a = this._def.valueType;
    for (const o in n.data)
      i.push({
        key: s._parse(new O(n, o, n.path, o)),
        value: a._parse(new O(n, n.data[o], n.path, o)),
        alwaysSet: o in n.data
      });
    return n.common.async ? T.mergeObjectAsync(t, i) : T.mergeObjectSync(t, i);
  }
  get element() {
    return this._def.valueType;
  }
  static create(e, t, n) {
    return t instanceof v ? new se({
      keyType: e,
      valueType: t,
      typeName: m.ZodRecord,
      ...y(n)
    }) : new se({
      keyType: R.create(),
      valueType: e,
      typeName: m.ZodRecord,
      ...y(t)
    });
  }
}
class Ne extends v {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(e) {
    const { status: t, ctx: n } = this._processInputParams(e);
    if (n.parsedType !== p.map)
      return u(n, {
        code: l.invalid_type,
        expected: p.map,
        received: n.parsedType
      }), g;
    const i = this._def.keyType, s = this._def.valueType, a = [...n.data.entries()].map(([o, c], d) => ({
      key: i._parse(new O(n, o, n.path, [d, "key"])),
      value: s._parse(new O(n, c, n.path, [d, "value"]))
    }));
    if (n.common.async) {
      const o = /* @__PURE__ */ new Map();
      return Promise.resolve().then(async () => {
        for (const c of a) {
          const d = await c.key, h = await c.value;
          if (d.status === "aborted" || h.status === "aborted")
            return g;
          (d.status === "dirty" || h.status === "dirty") && t.dirty(), o.set(d.value, h.value);
        }
        return { status: t.value, value: o };
      });
    } else {
      const o = /* @__PURE__ */ new Map();
      for (const c of a) {
        const d = c.key, h = c.value;
        if (d.status === "aborted" || h.status === "aborted")
          return g;
        (d.status === "dirty" || h.status === "dirty") && t.dirty(), o.set(d.value, h.value);
      }
      return { status: t.value, value: o };
    }
  }
}
Ne.create = (r, e, t) => new Ne({
  valueType: e,
  keyType: r,
  typeName: m.ZodMap,
  ...y(t)
});
class Q extends v {
  _parse(e) {
    const { status: t, ctx: n } = this._processInputParams(e);
    if (n.parsedType !== p.set)
      return u(n, {
        code: l.invalid_type,
        expected: p.set,
        received: n.parsedType
      }), g;
    const i = this._def;
    i.minSize !== null && n.data.size < i.minSize.value && (u(n, {
      code: l.too_small,
      minimum: i.minSize.value,
      type: "set",
      inclusive: !0,
      exact: !1,
      message: i.minSize.message
    }), t.dirty()), i.maxSize !== null && n.data.size > i.maxSize.value && (u(n, {
      code: l.too_big,
      maximum: i.maxSize.value,
      type: "set",
      inclusive: !0,
      exact: !1,
      message: i.maxSize.message
    }), t.dirty());
    const s = this._def.valueType;
    function a(c) {
      const d = /* @__PURE__ */ new Set();
      for (const h of c) {
        if (h.status === "aborted")
          return g;
        h.status === "dirty" && t.dirty(), d.add(h.value);
      }
      return { status: t.value, value: d };
    }
    const o = [...n.data.values()].map((c, d) => s._parse(new O(n, c, n.path, d)));
    return n.common.async ? Promise.all(o).then((c) => a(c)) : a(o);
  }
  min(e, t) {
    return new Q({
      ...this._def,
      minSize: { value: e, message: f.toString(t) }
    });
  }
  max(e, t) {
    return new Q({
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
Q.create = (r, e) => new Q({
  valueType: r,
  minSize: null,
  maxSize: null,
  typeName: m.ZodSet,
  ...y(e)
});
class Re extends v {
  get schema() {
    return this._def.getter();
  }
  _parse(e) {
    const { ctx: t } = this._processInputParams(e);
    return this._def.getter()._parse({ data: t.data, path: t.path, parent: t });
  }
}
Re.create = (r, e) => new Re({
  getter: r,
  typeName: m.ZodLazy,
  ...y(e)
});
class je extends v {
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
je.create = (r, e) => new je({
  value: r,
  typeName: m.ZodLiteral,
  ...y(e)
});
function Be(r, e) {
  return new U({
    values: r,
    typeName: m.ZodEnum,
    ...y(e)
  });
}
class U extends v {
  _parse(e) {
    if (typeof e.data != "string") {
      const t = this._getOrReturnCtx(e), n = this._def.values;
      return u(t, {
        expected: k.joinValues(n),
        received: t.parsedType,
        code: l.invalid_type
      }), g;
    }
    if (this._cache || (this._cache = new Set(this._def.values)), !this._cache.has(e.data)) {
      const t = this._getOrReturnCtx(e), n = this._def.values;
      return u(t, {
        received: t.data,
        code: l.invalid_enum_value,
        options: n
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
    return U.create(e, {
      ...this._def,
      ...t
    });
  }
  exclude(e, t = this._def) {
    return U.create(this.options.filter((n) => !e.includes(n)), {
      ...this._def,
      ...t
    });
  }
}
U.create = Be;
class Ze extends v {
  _parse(e) {
    const t = k.getValidEnumValues(this._def.values), n = this._getOrReturnCtx(e);
    if (n.parsedType !== p.string && n.parsedType !== p.number) {
      const i = k.objectValues(t);
      return u(n, {
        expected: k.joinValues(i),
        received: n.parsedType,
        code: l.invalid_type
      }), g;
    }
    if (this._cache || (this._cache = new Set(k.getValidEnumValues(this._def.values))), !this._cache.has(e.data)) {
      const i = k.objectValues(t);
      return u(n, {
        received: n.data,
        code: l.invalid_enum_value,
        options: i
      }), g;
    }
    return C(e.data);
  }
  get enum() {
    return this._def.values;
  }
}
Ze.create = (r, e) => new Ze({
  values: r,
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
    const n = t.parsedType === p.promise ? t.data : Promise.resolve(t.data);
    return C(n.then((i) => this._def.type.parseAsync(i, {
      path: t.path,
      errorMap: t.common.contextualErrorMap
    })));
  }
}
ae.create = (r, e) => new ae({
  type: r,
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
    const { status: t, ctx: n } = this._processInputParams(e), i = this._def.effect || null, s = {
      addIssue: (a) => {
        u(n, a), a.fatal ? t.abort() : t.dirty();
      },
      get path() {
        return n.path;
      }
    };
    if (s.addIssue = s.addIssue.bind(s), i.type === "preprocess") {
      const a = i.transform(n.data, s);
      if (n.common.async)
        return Promise.resolve(a).then(async (o) => {
          if (t.value === "aborted")
            return g;
          const c = await this._def.schema._parseAsync({
            data: o,
            path: n.path,
            parent: n
          });
          return c.status === "aborted" ? g : c.status === "dirty" || t.value === "dirty" ? H(c.value) : c;
        });
      {
        if (t.value === "aborted")
          return g;
        const o = this._def.schema._parseSync({
          data: a,
          path: n.path,
          parent: n
        });
        return o.status === "aborted" ? g : o.status === "dirty" || t.value === "dirty" ? H(o.value) : o;
      }
    }
    if (i.type === "refinement") {
      const a = (o) => {
        const c = i.refinement(o, s);
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
        return o.status === "aborted" ? g : (o.status === "dirty" && t.dirty(), a(o.value), { status: t.value, value: o.value });
      } else
        return this._def.schema._parseAsync({ data: n.data, path: n.path, parent: n }).then((o) => o.status === "aborted" ? g : (o.status === "dirty" && t.dirty(), a(o.value).then(() => ({ status: t.value, value: o.value }))));
    }
    if (i.type === "transform")
      if (n.common.async === !1) {
        const a = this._def.schema._parseSync({
          data: n.data,
          path: n.path,
          parent: n
        });
        if (!V(a))
          return g;
        const o = i.transform(a.value, s);
        if (o instanceof Promise)
          throw new Error("Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.");
        return { status: t.value, value: o };
      } else
        return this._def.schema._parseAsync({ data: n.data, path: n.path, parent: n }).then((a) => V(a) ? Promise.resolve(i.transform(a.value, s)).then((o) => ({
          status: t.value,
          value: o
        })) : g);
    k.assertNever(i);
  }
}
z.create = (r, e, t) => new z({
  schema: r,
  typeName: m.ZodEffects,
  effect: e,
  ...y(t)
});
z.createWithPreprocess = (r, e, t) => new z({
  schema: e,
  effect: { type: "preprocess", transform: r },
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
$.create = (r, e) => new $({
  innerType: r,
  typeName: m.ZodOptional,
  ...y(e)
});
class F extends v {
  _parse(e) {
    return this._getType(e) === p.null ? C(null) : this._def.innerType._parse(e);
  }
  unwrap() {
    return this._def.innerType;
  }
}
F.create = (r, e) => new F({
  innerType: r,
  typeName: m.ZodNullable,
  ...y(e)
});
class _e extends v {
  _parse(e) {
    const { ctx: t } = this._processInputParams(e);
    let n = t.data;
    return t.parsedType === p.undefined && (n = this._def.defaultValue()), this._def.innerType._parse({
      data: n,
      path: t.path,
      parent: t
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
}
_e.create = (r, e) => new _e({
  innerType: r,
  typeName: m.ZodDefault,
  defaultValue: typeof e.default == "function" ? e.default : () => e.default,
  ...y(e)
});
class me extends v {
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
    return te(i) ? i.then((s) => ({
      status: "valid",
      value: s.status === "valid" ? s.value : this._def.catchValue({
        get error() {
          return new j(n.common.issues);
        },
        input: n.data
      })
    })) : {
      status: "valid",
      value: i.status === "valid" ? i.value : this._def.catchValue({
        get error() {
          return new j(n.common.issues);
        },
        input: n.data
      })
    };
  }
  removeCatch() {
    return this._def.innerType;
  }
}
me.create = (r, e) => new me({
  innerType: r,
  typeName: m.ZodCatch,
  catchValue: typeof e.catch == "function" ? e.catch : () => e.catch,
  ...y(e)
});
class $e extends v {
  _parse(e) {
    if (this._getType(e) !== p.nan) {
      const n = this._getOrReturnCtx(e);
      return u(n, {
        code: l.invalid_type,
        expected: p.nan,
        received: n.parsedType
      }), g;
    }
    return { status: "valid", value: e.data };
  }
}
$e.create = (r) => new $e({
  typeName: m.ZodNaN,
  ...y(r)
});
class At extends v {
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
class ve extends v {
  _parse(e) {
    const { status: t, ctx: n } = this._processInputParams(e);
    if (n.common.async)
      return (async () => {
        const s = await this._def.in._parseAsync({
          data: n.data,
          path: n.path,
          parent: n
        });
        return s.status === "aborted" ? g : s.status === "dirty" ? (t.dirty(), H(s.value)) : this._def.out._parseAsync({
          data: s.value,
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
      return i.status === "aborted" ? g : i.status === "dirty" ? (t.dirty(), {
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
    return new ve({
      in: e,
      out: t,
      typeName: m.ZodPipeline
    });
  }
}
class ge extends v {
  _parse(e) {
    const t = this._def.innerType._parse(e), n = (i) => (V(i) && (i.value = Object.freeze(i.value)), i);
    return te(t) ? t.then((i) => n(i)) : n(t);
  }
  unwrap() {
    return this._def.innerType;
  }
}
ge.create = (r, e) => new ge({
  innerType: r,
  typeName: m.ZodReadonly,
  ...y(e)
});
var m;
(function(r) {
  r.ZodString = "ZodString", r.ZodNumber = "ZodNumber", r.ZodNaN = "ZodNaN", r.ZodBigInt = "ZodBigInt", r.ZodBoolean = "ZodBoolean", r.ZodDate = "ZodDate", r.ZodSymbol = "ZodSymbol", r.ZodUndefined = "ZodUndefined", r.ZodNull = "ZodNull", r.ZodAny = "ZodAny", r.ZodUnknown = "ZodUnknown", r.ZodNever = "ZodNever", r.ZodVoid = "ZodVoid", r.ZodArray = "ZodArray", r.ZodObject = "ZodObject", r.ZodUnion = "ZodUnion", r.ZodDiscriminatedUnion = "ZodDiscriminatedUnion", r.ZodIntersection = "ZodIntersection", r.ZodTuple = "ZodTuple", r.ZodRecord = "ZodRecord", r.ZodMap = "ZodMap", r.ZodSet = "ZodSet", r.ZodFunction = "ZodFunction", r.ZodLazy = "ZodLazy", r.ZodLiteral = "ZodLiteral", r.ZodEnum = "ZodEnum", r.ZodEffects = "ZodEffects", r.ZodNativeEnum = "ZodNativeEnum", r.ZodOptional = "ZodOptional", r.ZodNullable = "ZodNullable", r.ZodDefault = "ZodDefault", r.ZodCatch = "ZodCatch", r.ZodPromise = "ZodPromise", r.ZodBranded = "ZodBranded", r.ZodPipeline = "ZodPipeline", r.ZodReadonly = "ZodReadonly";
})(m || (m = {}));
const _ = R.create, Y = B.create, ke = pe.create, be = fe.create;
M.create;
const A = I.create, E = x.create;
re.create;
ie.create;
L.create;
const X = se.create, N = U.create;
ae.create;
$.create;
F.create;
const Ue = z.createWithPreprocess, Ot = N(["log", "span", "metric"]), Nt = N(["ok", "error", "unset"]), Rt = N(["counter", "gauge", "histogram", "summary"]), jt = N([
  "json",
  "rpc",
  "protobuf",
  "text",
  "binary",
  "stream"
]), Zt = N(["raw", "base64", "gzip+base64", "protobuf"]), $t = E({
  log_id: _().min(1),
  timestamp: _().datetime(),
  record_kind: Ot,
  trace_id: _().min(1),
  span_id: _().min(1),
  parent_span_id: _().optional(),
  event_key: _().min(1),
  event_version: _().regex(/^\d{3}$/),
  span_name: _().optional(),
  start_time: _().datetime().optional(),
  end_time: _().datetime().optional(),
  status_code: Nt.optional(),
  payload_format: jt,
  payload_encoding: Zt,
  payload_masking_applied: ke(),
  payload_masked_fields: A(_()),
  payload: be(),
  qa_session_id: _().optional(),
  // Address context
  address_context: X(_(), _()).optional(),
  // Metric (when record_kind === "metric")
  metric_type: Rt.optional(),
  metric_name: _().optional(),
  metric_value: Y().optional(),
  metric_unit: _().optional(),
  metric_labels: X(_(), _()).optional(),
  metric_buckets: A(Y()).optional(),
  metric_quantiles: A(Y()).optional(),
  actor_id: _().optional(),
  user_id: _().optional(),
  user_attributes: X(_()).optional()
}), Mt = N([
  "tenant",
  "workspace",
  "user",
  "agent"
]), Lt = E({
  owner_type: Mt,
  owner_id: _().min(1)
}), zt = E({
  service_name: _().min(1),
  sdk_name: _().min(1),
  sdk_version: _().min(1)
}), Pt = E({
  platform: _().min(1),
  device_ref: _().optional(),
  os_version: _().optional(),
  app_version: _().optional()
}), Dt = _().min(1), Vt = E({
  env: Dt,
  build_ref: _().optional(),
  release_version: _().optional()
});
E({
  transmission_id: _().min(1),
  sent_at: _().datetime(),
  owner: Lt,
  source: zt,
  runtime: Pt,
  build: Vt,
  infra_context: X(_(), _()).optional(),
  entry_snapshot: _().optional(),
  records: A($t).min(1)
});
const Bt = N([
  "eq",
  "neq",
  "exists",
  "gt",
  "lt",
  "contains",
  "masked"
]), Fe = E({
  field: _().min(1),
  op: Bt,
  value: be().optional()
}), Ut = E({
  field: _().min(1),
  op: N(["eq", "neq", "exists", "gt", "lt", "contains"]),
  value: be().optional()
}), Ft = E({
  condition: Fe,
  next: A(_().min(1))
}), Wt = N(["sequence", "optional", "branch"]), Ht = E({
  id: _().min(1),
  event_key: _().min(1),
  event_version: _().regex(/^\d{3}$/).optional(),
  source: _().optional(),
  record_kind: N(["log", "span"]).optional(),
  required: ke(),
  kind: Wt,
  constraints: A(Fe).optional(),
  timeout_ms: Y().int().positive().optional(),
  next: A(_().min(1)).optional(),
  branches: A(Ft).optional()
});
E({
  scenario_id: _().min(1),
  version: _().min(1),
  domain: _().min(1),
  description: _().optional(),
  entry_conditions: A(Ut).optional(),
  steps: A(Ht).min(1)
});
function ee(r) {
  const e = new Error(r);
  return e.source = "ulid", e;
}
const xe = "0123456789ABCDEFGHJKMNPQRSTVWXYZ", K = xe.length, Me = Math.pow(2, 48) - 1, Kt = 10, Gt = 16;
function Qt(r) {
  let e = Math.floor(r() * K);
  return e === K && (e = K - 1), xe.charAt(e);
}
function Jt(r, e) {
  if (isNaN(r))
    throw new Error(r + " must be a number");
  if (r > Me)
    throw ee("cannot encode time greater than " + Me);
  if (r < 0)
    throw ee("time must be positive");
  if (Number.isInteger(Number(r)) === !1)
    throw ee("time must be an integer");
  let t, n = "";
  for (; e > 0; e--)
    t = r % K, n = xe.charAt(t) + n, r = (r - t) / K;
  return n;
}
function Yt(r, e) {
  let t = "";
  for (; r > 0; r--)
    t = Qt(e) + t;
  return t;
}
function Xt(r = !1, e) {
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
  throw ee("secure crypto unusable, insecure Math.random not allowed");
}
function en(r) {
  return r || (r = Xt()), function(t) {
    return isNaN(t) && (t = Date.now()), Jt(t, Kt) + Yt(Gt, r);
  };
}
const J = en();
function tn() {
  return `txm_${J()}`;
}
function de() {
  return `log_${J()}`;
}
function We() {
  return `trc_${J()}`;
}
function nn() {
  return `spn_${J()}`;
}
function rn() {
  return `qas_${J()}`;
}
function P() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
const sn = (r) => typeof r == "string" && r.trim().length === 0 ? void 0 : r;
Ue(sn, _().url().optional());
Ue((r) => {
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
}, ke().default(!1));
class oe {
  constructor(e) {
    b(this, "trace_id");
    b(this, "spanStack", []);
    b(this, "qa_session_id");
    this.trace_id = (e == null ? void 0 : e.trace_id) ?? We(), this.qa_session_id = e == null ? void 0 : e.qa_session_id;
  }
  /** Push a new span onto the stack. Returns the new span_id. */
  pushSpan(e) {
    const t = e ?? nn();
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
function an(r, e) {
  const t = { ...r }, n = [];
  for (const i of e)
    if (i.field in t)
      switch (n.push(i.field), i.mode) {
        case "raw":
          break;
        case "mask": {
          const s = {
            _masked: !0,
            _present: t[i.field] !== void 0 && t[i.field] !== null
          };
          t[i.field] = s;
          break;
        }
        case "drop":
          delete t[i.field];
          break;
        case "hash": {
          const s = t[i.field];
          t[i.field] = on(String(s));
          break;
        }
      }
  return { masked: t, maskedFields: n };
}
function on(r) {
  let e = 0;
  for (let t = 0; t < r.length; t++) {
    const n = r.charCodeAt(t);
    e = (e << 5) - e + n | 0;
  }
  return `h_${(e >>> 0).toString(16).padStart(8, "0")}`;
}
const ln = 50, cn = 5e3, dn = 500;
class un {
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
    this.config = e, this.batchSize = e.batchSize ?? ln, this.flushIntervalMs = e.flushIntervalMs ?? cn, this.maxBufferSize = e.maxBufferSize ?? dn, this.flushIntervalMs > 0 && (this.flushTimer = setInterval(() => {
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
    const t = this.ensureContext(), { payload: n, maskedFields: i, maskingApplied: s } = this.processPayload(e.payload), a = {
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
      payload_masking_applied: s,
      payload_masked_fields: i,
      payload: n,
      qa_session_id: e.qa_session_id ?? t.qa_session_id,
      ...e.address_context ? { address_context: e.address_context } : {},
      ...this.actorFields()
    };
    return this.addRecord(a), a;
  }
  // ── Span ───────────────────────────────────────────
  /** Start a span. Returns a handle to end it. */
  startSpan(e) {
    const t = this.ensureContext(), n = t.pushSpan(), i = t.parentSpanId, s = P();
    return {
      span_id: n,
      end: (a) => {
        t.popSpan();
        const o = {
          ...e.payload,
          ...a == null ? void 0 : a.payload
        }, { payload: c, maskedFields: d, maskingApplied: h } = this.processPayload(Object.keys(o).length > 0 ? o : void 0), S = {
          log_id: de(),
          timestamp: P(),
          record_kind: "span",
          trace_id: t.trace_id,
          span_id: n,
          parent_span_id: i,
          event_key: e.event_key,
          event_version: e.event_version,
          span_name: e.span_name,
          start_time: s,
          end_time: P(),
          status_code: (a == null ? void 0 : a.status_code) ?? "ok",
          payload_format: e.payload_format ?? "json",
          payload_encoding: e.payload_encoding ?? "raw",
          payload_masking_applied: h,
          payload_masked_fields: d,
          payload: c,
          qa_session_id: e.qa_session_id ?? t.qa_session_id,
          ...e.address_context ? { address_context: e.address_context } : {},
          ...this.actorFields()
        };
        return this.addRecord(S), S;
      }
    };
  }
  // ── Metric ──────────────────────────────────────────
  /** Record a metric event. */
  metric(e, t, n) {
    const i = this.ensureContext(), s = {
      log_id: de(),
      timestamp: P(),
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
      const n = [...e, ...this.buffer];
      if (n.length > this.maxBufferSize) {
        const s = n.splice(0, n.length - this.maxBufferSize);
        this.handleError(new Error(`[qa-sdk:flush] buffer overflow — dropped ${s.length} oldest records`), "buffer-overflow");
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
    return this.activeContext || (this.activeContext = new oe()), this.activeContext;
  }
  processPayload(e) {
    if (!e)
      return { payload: null, maskedFields: [], maskingApplied: !1 };
    const t = this.config.maskingRules;
    if (!t || t.length === 0)
      return { payload: e, maskedFields: [], maskingApplied: !1 };
    const { masked: n, maskedFields: i } = an(e, t);
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
      transmission_id: tn(),
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
function W(r) {
  var t;
  if (!r.name) throw new RangeError("PackFormat: name is required");
  if (r.chars <= 0) throw new RangeError(`PackFormat "${r.name}": chars must be > 0`);
  const e = (t = r.groups) != null && t.length ? Object.freeze([...r.groups]) : void 0;
  if (e) {
    const n = e.reduce((i, s) => i + s, 0);
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
W({ name: "int64", chars: 16, label: "64-bit Integer" }), W({ name: "objectId", chars: 24, label: "96-bit ObjectId" }), W({ name: "uuid", chars: 32, label: "UUID (128-bit)", groups: [8, 4, 4, 4, 12] }), W({ name: "sha1", chars: 40, label: "160-bit (SHA-1)" }), W({ name: "sha256", chars: 64, label: "256-bit (SHA-256)" });
const pn = [
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
], fn = [
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
], hn = [
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
], _n = [
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
], mn = [
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
], gn = [
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
], yn = [
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
], vn = [
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
], He = [
  ...pn,
  ...fn,
  ...hn,
  ..._n,
  ...mn,
  ...gn,
  ...yn,
  ...vn
], Ke = new Map(He.map((r) => [r.event_key, r]));
function kn(r) {
  return Ke.get(r);
}
He.filter((r) => r.auto_collectable);
const bn = [
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
new Map(bn.map((r) => [r.event_key, r]));
const xn = [
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
xn.map((r) => {
  const e = Ke.get(r);
  if (!e)
    throw new Error(`v1 minimal event not found in registry: ${r}`);
  return e;
});
class wn {
  constructor(e) {
    b(this, "endpoint");
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
const Ge = "qa_monitor";
function Le(r = Ge) {
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
    sessionId: rn(),
    traceId: We()
  };
  try {
    sessionStorage.setItem(r, JSON.stringify(e));
  } catch {
  }
  return e;
}
function Sn(r = Ge) {
  try {
    sessionStorage.removeItem(r);
  } catch {
  }
}
function Tn(r, e) {
  const t = [];
  if (r.clicks) {
    const n = (i) => {
      var o;
      const s = i.target;
      if (!s) return;
      const a = s.closest("button, a, [data-qa-event]");
      a && e("click", {
        tag: a.tagName.toLowerCase(),
        text: ((o = a.textContent) == null ? void 0 : o.trim().slice(0, 100)) ?? "",
        qa_id: a.dataset.qaId ?? a.id ?? void 0,
        href: a instanceof HTMLAnchorElement ? a.href : void 0,
        qa_event: a.dataset.qaEvent ?? void 0
      });
    };
    document.addEventListener("click", n, !0), t.push(() => document.removeEventListener("click", n, !0));
  }
  if (r.forms) {
    const n = (i) => {
      const s = i.target;
      if (!s) return;
      const a = new FormData(s), o = [];
      a.forEach((c, d) => o.push(d)), e("form_submit", {
        form_id: s.id || void 0,
        form_action: s.action || void 0,
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
    history.pushState = function(...s) {
      i.call(history, ...s), e("page_view", { url: location.href });
    }, t.push(() => {
      history.pushState = i;
    });
  }
  return () => t.forEach((n) => n());
}
function Cn(r, e, t) {
  const n = r[e];
  if (!n) return null;
  const i = [], s = [];
  for (const c of n.labels) {
    const d = n.dims[c];
    if (!d) return null;
    if (d.kind === "axis") {
      i.push(d.capacity ?? d.entries.length);
      const h = d.entries.indexOf(t[c]);
      if (h < 0) return null;
      s.push(h);
    } else {
      const h = d.values;
      i.push(h.length);
      const S = t[c] ?? h[0], w = h.indexOf(S);
      s.push(w < 0 ? 0 : w);
    }
  }
  const a = new Array(i.length);
  a[i.length - 1] = 1;
  for (let c = i.length - 2; c >= 0; c--) a[c] = a[c + 1] * i[c + 1];
  let o = 0;
  for (let c = 0; c < s.length; c++) o += s[c] * a[c];
  return { prefix: e, version: n.version, address: o, serialized: `${e}:${n.version}:${o}` };
}
function qn(r, e) {
  const t = e.split(":"), [n, i, s] = t.length === 4 ? [t[1], t[2], t[3]] : [t[0], t[1], t[2]], a = r[n];
  if (!a) return null;
  let o = parseInt(s);
  if (isNaN(o)) return null;
  const c = [], d = [];
  for (const w of a.labels) {
    const q = a.dims[w];
    q && (q.kind === "axis" ? c.push(q.capacity ?? q.entries.length) : c.push(q.values.length), d.push({ label: w, dim: q }));
  }
  const h = new Array(c.length);
  h[c.length - 1] = 1;
  for (let w = c.length - 2; w >= 0; w--) h[w] = h[w + 1] * c[w + 1];
  const S = {};
  for (let w = 0; w < d.length; w++) {
    const q = Math.floor(o / h[w]);
    o %= h[w];
    const { label: Je, dim: le } = d[w];
    S[Je] = le.kind === "axis" ? le.entries[q] ?? `(${q})` : le.values[q] ?? q;
  }
  return { prefix: n, version: i, values: S };
}
function ye(r, e) {
  const t = {};
  for (const [n, i] of Object.entries(e)) {
    const s = r[n];
    if (!s) continue;
    const a = { ...i };
    for (const c of s.labels) {
      const d = s.dims[c];
      (d == null ? void 0 : d.kind) === "prefix_ref" && !(c in a) && (a[c] = d.values[0]);
    }
    const o = Cn(r, n, a);
    o && (t[n] = o.serialized);
  }
  return t;
}
function An(r, e) {
  const t = {};
  for (const [n, i] of Object.entries(e)) {
    const s = qn(r, i);
    s && (t[n] = { prefix: s.prefix, values: s.values });
  }
  return t;
}
const ze = {
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
class Qe {
  constructor(e) {
    b(this, "logger");
    b(this, "session");
    b(this, "storageKey");
    b(this, "destroyAutoCapture", null);
    b(this, "unloadHandler");
    b(this, "_status", "active");
    var c, d;
    this.storageKey = e.storageKey ?? "qa_monitor", this.session = Le(this.storageKey);
    const t = new wn(`${e.ingestUrl}/v1/ingest`), n = e.serviceConfig, i = n ? et(n, "@qa-sdk/browser", "0.1.0") : { service_name: ((c = e.meta) == null ? void 0 : c.serviceName) ?? "browser", sdk_name: "@qa-sdk/browser", sdk_version: "0.1.0" }, s = n ? tt(n) : { env: ((d = e.meta) == null ? void 0 : d.env) ?? "production" };
    let a = e.infraContext;
    if (!a && n)
      try {
        const h = Pe(n);
        a = ye(ze, { service: h });
      } catch {
      }
    this.logger = new un({
      transport: t,
      owner: e.owner ?? { owner_type: "tenant", owner_id: "browser-monitor" },
      source: i,
      runtime: {
        platform: "browser",
        os_version: typeof navigator < "u" ? navigator.userAgent : "unknown"
      },
      build: s,
      flushIntervalMs: 5e3,
      onError: e.onError,
      ...a ? { infraContext: a } : {},
      ...e.entrySnapshot ? { entrySnapshot: e.entrySnapshot } : {}
    });
    const o = new oe({
      trace_id: this.session.traceId,
      qa_session_id: this.session.sessionId
    });
    this.logger.setContext(o), e.scenarioId && this.emit("session_start", { scenario_id: e.scenarioId }), e.autoCapture && (this.destroyAutoCapture = Tn(e.autoCapture, (h, S) => {
      this.emit(h, S);
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
    const i = ye(ze, t);
    this.emit(e, n ?? { event: e }, { address_context: i });
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
    const i = kn(e), s = ((i == null ? void 0 : i.event_version) ?? "1").padStart(3, "0");
    this.logger.log({
      event_key: e,
      event_version: s,
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
    Sn(this.storageKey);
    const e = Le(this.storageKey), t = new oe({
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
function On(r) {
  return new Qe(r);
}
async function Nn(r) {
  if (r.registry)
    try {
      const { loadCatalog: e } = await import("./catalog-loader-8xiUKhkX.js"), t = await e({
        registryUrl: r.registry,
        cacheKey: `qa-catalog-${r.catalogId ?? "demo"}`
      });
      if (r.serviceConfig && !r.infraContext) {
        const n = Pe(r.serviceConfig);
        r = {
          ...r,
          infraContext: ye(t.catalog, { service: n })
        };
      }
    } catch {
    }
  return new Qe(r);
}
export {
  ze as BROWSER_CATALOG,
  wn as BeaconTransport,
  Qe as QaMonitor,
  In as buildEnvToCatalogEnv,
  it as catalogEnvToBuildEnv,
  On as createQaMonitor,
  Nn as createQaMonitorAsync,
  qn as decode,
  An as decodeContext,
  Cn as encode,
  de as newLogId,
  rn as newQaSessionId,
  nn as newSpanId,
  We as newTraceId,
  tn as newTransmissionId,
  Pe as toServiceDims,
  tt as toTransmissionBuild,
  et as toTransmissionSource,
  ye as track
};
//# sourceMappingURL=qa-browser-sdk.js.map
