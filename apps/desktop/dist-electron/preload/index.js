import { contextBridge as $e, ipcRenderer as S, webUtils as Me } from "electron";
var _;
(function(s) {
  s.assertEqual = (r) => {
  };
  function e(r) {
  }
  s.assertIs = e;
  function t(r) {
    throw new Error();
  }
  s.assertNever = t, s.arrayToEnum = (r) => {
    const a = {};
    for (const i of r)
      a[i] = i;
    return a;
  }, s.getValidEnumValues = (r) => {
    const a = s.objectKeys(r).filter((o) => typeof r[r[o]] != "number"), i = {};
    for (const o of a)
      i[o] = r[o];
    return s.objectValues(i);
  }, s.objectValues = (r) => s.objectKeys(r).map(function(a) {
    return r[a];
  }), s.objectKeys = typeof Object.keys == "function" ? (r) => Object.keys(r) : (r) => {
    const a = [];
    for (const i in r)
      Object.prototype.hasOwnProperty.call(r, i) && a.push(i);
    return a;
  }, s.find = (r, a) => {
    for (const i of r)
      if (a(i))
        return i;
  }, s.isInteger = typeof Number.isInteger == "function" ? (r) => Number.isInteger(r) : (r) => typeof r == "number" && Number.isFinite(r) && Math.floor(r) === r;
  function n(r, a = " | ") {
    return r.map((i) => typeof i == "string" ? `'${i}'` : i).join(a);
  }
  s.joinValues = n, s.jsonStringifyReplacer = (r, a) => typeof a == "bigint" ? a.toString() : a;
})(_ || (_ = {}));
var ve;
(function(s) {
  s.mergeShapes = (e, t) => ({
    ...e,
    ...t
    // second overwrites first
  });
})(ve || (ve = {}));
const l = _.arrayToEnum([
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
]), V = (s) => {
  switch (typeof s) {
    case "undefined":
      return l.undefined;
    case "string":
      return l.string;
    case "number":
      return Number.isNaN(s) ? l.nan : l.number;
    case "boolean":
      return l.boolean;
    case "function":
      return l.function;
    case "bigint":
      return l.bigint;
    case "symbol":
      return l.symbol;
    case "object":
      return Array.isArray(s) ? l.array : s === null ? l.null : s.then && typeof s.then == "function" && s.catch && typeof s.catch == "function" ? l.promise : typeof Map < "u" && s instanceof Map ? l.map : typeof Set < "u" && s instanceof Set ? l.set : typeof Date < "u" && s instanceof Date ? l.date : l.object;
    default:
      return l.unknown;
  }
}, d = _.arrayToEnum([
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
class M extends Error {
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
    }, n = { _errors: [] }, r = (a) => {
      for (const i of a.issues)
        if (i.code === "invalid_union")
          i.unionErrors.map(r);
        else if (i.code === "invalid_return_type")
          r(i.returnTypeError);
        else if (i.code === "invalid_arguments")
          r(i.argumentsError);
        else if (i.path.length === 0)
          n._errors.push(t(i));
        else {
          let o = n, f = 0;
          for (; f < i.path.length; ) {
            const m = i.path[f];
            f === i.path.length - 1 ? (o[m] = o[m] || { _errors: [] }, o[m]._errors.push(t(i))) : o[m] = o[m] || { _errors: [] }, o = o[m], f++;
          }
        }
    };
    return r(this), n;
  }
  static assert(e) {
    if (!(e instanceof M))
      throw new Error(`Not a ZodError: ${e}`);
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, _.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(e = (t) => t.message) {
    const t = {}, n = [];
    for (const r of this.issues)
      if (r.path.length > 0) {
        const a = r.path[0];
        t[a] = t[a] || [], t[a].push(e(r));
      } else
        n.push(e(r));
    return { formErrors: n, fieldErrors: t };
  }
  get formErrors() {
    return this.flatten();
  }
}
M.create = (s) => new M(s);
const de = (s, e) => {
  let t;
  switch (s.code) {
    case d.invalid_type:
      s.received === l.undefined ? t = "Required" : t = `Expected ${s.expected}, received ${s.received}`;
      break;
    case d.invalid_literal:
      t = `Invalid literal value, expected ${JSON.stringify(s.expected, _.jsonStringifyReplacer)}`;
      break;
    case d.unrecognized_keys:
      t = `Unrecognized key(s) in object: ${_.joinValues(s.keys, ", ")}`;
      break;
    case d.invalid_union:
      t = "Invalid input";
      break;
    case d.invalid_union_discriminator:
      t = `Invalid discriminator value. Expected ${_.joinValues(s.options)}`;
      break;
    case d.invalid_enum_value:
      t = `Invalid enum value. Expected ${_.joinValues(s.options)}, received '${s.received}'`;
      break;
    case d.invalid_arguments:
      t = "Invalid function arguments";
      break;
    case d.invalid_return_type:
      t = "Invalid function return type";
      break;
    case d.invalid_date:
      t = "Invalid date";
      break;
    case d.invalid_string:
      typeof s.validation == "object" ? "includes" in s.validation ? (t = `Invalid input: must include "${s.validation.includes}"`, typeof s.validation.position == "number" && (t = `${t} at one or more positions greater than or equal to ${s.validation.position}`)) : "startsWith" in s.validation ? t = `Invalid input: must start with "${s.validation.startsWith}"` : "endsWith" in s.validation ? t = `Invalid input: must end with "${s.validation.endsWith}"` : _.assertNever(s.validation) : s.validation !== "regex" ? t = `Invalid ${s.validation}` : t = "Invalid";
      break;
    case d.too_small:
      s.type === "array" ? t = `Array must contain ${s.exact ? "exactly" : s.inclusive ? "at least" : "more than"} ${s.minimum} element(s)` : s.type === "string" ? t = `String must contain ${s.exact ? "exactly" : s.inclusive ? "at least" : "over"} ${s.minimum} character(s)` : s.type === "number" ? t = `Number must be ${s.exact ? "exactly equal to " : s.inclusive ? "greater than or equal to " : "greater than "}${s.minimum}` : s.type === "bigint" ? t = `Number must be ${s.exact ? "exactly equal to " : s.inclusive ? "greater than or equal to " : "greater than "}${s.minimum}` : s.type === "date" ? t = `Date must be ${s.exact ? "exactly equal to " : s.inclusive ? "greater than or equal to " : "greater than "}${new Date(Number(s.minimum))}` : t = "Invalid input";
      break;
    case d.too_big:
      s.type === "array" ? t = `Array must contain ${s.exact ? "exactly" : s.inclusive ? "at most" : "less than"} ${s.maximum} element(s)` : s.type === "string" ? t = `String must contain ${s.exact ? "exactly" : s.inclusive ? "at most" : "under"} ${s.maximum} character(s)` : s.type === "number" ? t = `Number must be ${s.exact ? "exactly" : s.inclusive ? "less than or equal to" : "less than"} ${s.maximum}` : s.type === "bigint" ? t = `BigInt must be ${s.exact ? "exactly" : s.inclusive ? "less than or equal to" : "less than"} ${s.maximum}` : s.type === "date" ? t = `Date must be ${s.exact ? "exactly" : s.inclusive ? "smaller than or equal to" : "smaller than"} ${new Date(Number(s.maximum))}` : t = "Invalid input";
      break;
    case d.custom:
      t = "Invalid input";
      break;
    case d.invalid_intersection_types:
      t = "Intersection results could not be merged";
      break;
    case d.not_multiple_of:
      t = `Number must be a multiple of ${s.multipleOf}`;
      break;
    case d.not_finite:
      t = "Number must be finite";
      break;
    default:
      t = e.defaultError, _.assertNever(s);
  }
  return { message: t };
};
let Ve = de;
function Pe() {
  return Ve;
}
const Le = (s) => {
  const { data: e, path: t, errorMaps: n, issueData: r } = s, a = [...t, ...r.path || []], i = {
    ...r,
    path: a
  };
  if (r.message !== void 0)
    return {
      ...r,
      path: a,
      message: r.message
    };
  let o = "";
  const f = n.filter((m) => !!m).slice().reverse();
  for (const m of f)
    o = m(i, { data: e, defaultError: o }).message;
  return {
    ...r,
    path: a,
    message: o
  };
};
function u(s, e) {
  const t = Pe(), n = Le({
    issueData: e,
    data: s.data,
    path: s.path,
    errorMaps: [
      s.common.contextualErrorMap,
      // contextual error map is first priority
      s.schemaErrorMap,
      // then schema-bound map if available
      t,
      // then global override map
      t === de ? void 0 : de
      // then global default map
    ].filter((r) => !!r)
  });
  s.common.issues.push(n);
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
    for (const r of t) {
      if (r.status === "aborted")
        return p;
      r.status === "dirty" && e.dirty(), n.push(r.value);
    }
    return { status: e.value, value: n };
  }
  static async mergeObjectAsync(e, t) {
    const n = [];
    for (const r of t) {
      const a = await r.key, i = await r.value;
      n.push({
        key: a,
        value: i
      });
    }
    return T.mergeObjectSync(e, n);
  }
  static mergeObjectSync(e, t) {
    const n = {};
    for (const r of t) {
      const { key: a, value: i } = r;
      if (a.status === "aborted" || i.status === "aborted")
        return p;
      a.status === "dirty" && e.dirty(), i.status === "dirty" && e.dirty(), a.value !== "__proto__" && (typeof i.value < "u" || r.alwaysSet) && (n[a.value] = i.value);
    }
    return { status: e.value, value: n };
  }
}
const p = Object.freeze({
  status: "aborted"
}), J = (s) => ({ status: "dirty", value: s }), O = (s) => ({ status: "valid", value: s }), _e = (s) => s.status === "aborted", ke = (s) => s.status === "dirty", F = (s) => s.status === "valid", G = (s) => typeof Promise < "u" && s instanceof Promise;
var h;
(function(s) {
  s.errToObj = (e) => typeof e == "string" ? { message: e } : e || {}, s.toString = (e) => typeof e == "string" ? e : e == null ? void 0 : e.message;
})(h || (h = {}));
class Z {
  constructor(e, t, n, r) {
    this._cachedPath = [], this.parent = e, this.data = t, this._path = n, this._key = r;
  }
  get path() {
    return this._cachedPath.length || (Array.isArray(this._key) ? this._cachedPath.push(...this._path, ...this._key) : this._cachedPath.push(...this._path, this._key)), this._cachedPath;
  }
}
const xe = (s, e) => {
  if (F(e))
    return { success: !0, data: e.value };
  if (!s.common.issues.length)
    throw new Error("Validation failed but no issues detected.");
  return {
    success: !1,
    get error() {
      if (this._error)
        return this._error;
      const t = new M(s.common.issues);
      return this._error = t, this._error;
    }
  };
};
function y(s) {
  if (!s)
    return {};
  const { errorMap: e, invalid_type_error: t, required_error: n, description: r } = s;
  if (e && (t || n))
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  return e ? { errorMap: e, description: r } : { errorMap: (i, o) => {
    const { message: f } = s;
    return i.code === "invalid_enum_value" ? { message: f ?? o.defaultError } : typeof o.data > "u" ? { message: f ?? n ?? o.defaultError } : i.code !== "invalid_type" ? { message: o.defaultError } : { message: f ?? t ?? o.defaultError };
  }, description: r };
}
class v {
  get description() {
    return this._def.description;
  }
  _getType(e) {
    return V(e.data);
  }
  _getOrReturnCtx(e, t) {
    return t || {
      common: e.parent.common,
      data: e.data,
      parsedType: V(e.data),
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
        parsedType: V(e.data),
        schemaErrorMap: this._def.errorMap,
        path: e.path,
        parent: e.parent
      }
    };
  }
  _parseSync(e) {
    const t = this._parse(e);
    if (G(t))
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
      parsedType: V(e)
    }, r = this._parseSync({ data: e, path: n.path, parent: n });
    return xe(n, r);
  }
  "~validate"(e) {
    var n, r;
    const t = {
      common: {
        issues: [],
        async: !!this["~standard"].async
      },
      path: [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data: e,
      parsedType: V(e)
    };
    if (!this["~standard"].async)
      try {
        const a = this._parseSync({ data: e, path: [], parent: t });
        return F(a) ? {
          value: a.value
        } : {
          issues: t.common.issues
        };
      } catch (a) {
        (r = (n = a == null ? void 0 : a.message) == null ? void 0 : n.toLowerCase()) != null && r.includes("encountered") && (this["~standard"].async = !0), t.common = {
          issues: [],
          async: !0
        };
      }
    return this._parseAsync({ data: e, path: [], parent: t }).then((a) => F(a) ? {
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
      parsedType: V(e)
    }, r = this._parse({ data: e, path: n.path, parent: n }), a = await (G(r) ? r : Promise.resolve(r));
    return xe(n, a);
  }
  refine(e, t) {
    const n = (r) => typeof t == "string" || typeof t > "u" ? { message: t } : typeof t == "function" ? t(r) : t;
    return this._refinement((r, a) => {
      const i = e(r), o = () => a.addIssue({
        code: d.custom,
        ...n(r)
      });
      return typeof Promise < "u" && i instanceof Promise ? i.then((f) => f ? !0 : (o(), !1)) : i ? !0 : (o(), !1);
    });
  }
  refinement(e, t) {
    return this._refinement((n, r) => e(n) ? !0 : (r.addIssue(typeof t == "function" ? t(n, r) : t), !1));
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
    return $.create(this, this._def);
  }
  nullable() {
    return U.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return R.create(this);
  }
  promise() {
    return se.create(this, this._def);
  }
  or(e) {
    return X.create([this, e], this._def);
  }
  and(e) {
    return K.create(this, e, this._def);
  }
  transform(e) {
    return new D({
      ...y(this._def),
      schema: this,
      typeName: g.ZodEffects,
      effect: { type: "transform", transform: e }
    });
  }
  default(e) {
    const t = typeof e == "function" ? e : () => e;
    return new ne({
      ...y(this._def),
      innerType: this,
      defaultValue: t,
      typeName: g.ZodDefault
    });
  }
  brand() {
    return new Re({
      typeName: g.ZodBranded,
      type: this,
      ...y(this._def)
    });
  }
  catch(e) {
    const t = typeof e == "function" ? e : () => e;
    return new re({
      ...y(this._def),
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
    return ye.create(this, e);
  }
  readonly() {
    return ae.create(this);
  }
  isOptional() {
    return this.safeParse(void 0).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
}
const ze = /^c[^\s-]{8,}$/i, De = /^[0-9a-z]+$/, Ue = /^[0-9A-HJKMNP-TV-Z]{26}$/i, Be = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i, Fe = /^[a-z0-9_-]{21}$/i, We = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/, qe = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/, Je = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i, He = "^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$";
let ie;
const Ye = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/, Ge = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/, Qe = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/, Xe = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/, Ke = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/, et = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/, Oe = "((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))", tt = new RegExp(`^${Oe}$`);
function Ie(s) {
  let e = "[0-5]\\d";
  s.precision ? e = `${e}\\.\\d{${s.precision}}` : s.precision == null && (e = `${e}(\\.\\d+)?`);
  const t = s.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${e})${t}`;
}
function st(s) {
  return new RegExp(`^${Ie(s)}$`);
}
function nt(s) {
  let e = `${Oe}T${Ie(s)}`;
  const t = [];
  return t.push(s.local ? "Z?" : "Z"), s.offset && t.push("([+-]\\d{2}:?\\d{2})"), e = `${e}(${t.join("|")})`, new RegExp(`^${e}$`);
}
function rt(s, e) {
  return !!((e === "v4" || !e) && Ye.test(s) || (e === "v6" || !e) && Qe.test(s));
}
function at(s, e) {
  if (!We.test(s))
    return !1;
  try {
    const [t] = s.split(".");
    if (!t)
      return !1;
    const n = t.replace(/-/g, "+").replace(/_/g, "/").padEnd(t.length + (4 - t.length % 4) % 4, "="), r = JSON.parse(atob(n));
    return !(typeof r != "object" || r === null || "typ" in r && (r == null ? void 0 : r.typ) !== "JWT" || !r.alg || e && r.alg !== e);
  } catch {
    return !1;
  }
}
function it(s, e) {
  return !!((e === "v4" || !e) && Ge.test(s) || (e === "v6" || !e) && Xe.test(s));
}
class j extends v {
  _parse(e) {
    if (this._def.coerce && (e.data = String(e.data)), this._getType(e) !== l.string) {
      const a = this._getOrReturnCtx(e);
      return u(a, {
        code: d.invalid_type,
        expected: l.string,
        received: a.parsedType
      }), p;
    }
    const n = new T();
    let r;
    for (const a of this._def.checks)
      if (a.kind === "min")
        e.data.length < a.value && (r = this._getOrReturnCtx(e, r), u(r, {
          code: d.too_small,
          minimum: a.value,
          type: "string",
          inclusive: !0,
          exact: !1,
          message: a.message
        }), n.dirty());
      else if (a.kind === "max")
        e.data.length > a.value && (r = this._getOrReturnCtx(e, r), u(r, {
          code: d.too_big,
          maximum: a.value,
          type: "string",
          inclusive: !0,
          exact: !1,
          message: a.message
        }), n.dirty());
      else if (a.kind === "length") {
        const i = e.data.length > a.value, o = e.data.length < a.value;
        (i || o) && (r = this._getOrReturnCtx(e, r), i ? u(r, {
          code: d.too_big,
          maximum: a.value,
          type: "string",
          inclusive: !0,
          exact: !0,
          message: a.message
        }) : o && u(r, {
          code: d.too_small,
          minimum: a.value,
          type: "string",
          inclusive: !0,
          exact: !0,
          message: a.message
        }), n.dirty());
      } else if (a.kind === "email")
        Je.test(e.data) || (r = this._getOrReturnCtx(e, r), u(r, {
          validation: "email",
          code: d.invalid_string,
          message: a.message
        }), n.dirty());
      else if (a.kind === "emoji")
        ie || (ie = new RegExp(He, "u")), ie.test(e.data) || (r = this._getOrReturnCtx(e, r), u(r, {
          validation: "emoji",
          code: d.invalid_string,
          message: a.message
        }), n.dirty());
      else if (a.kind === "uuid")
        Be.test(e.data) || (r = this._getOrReturnCtx(e, r), u(r, {
          validation: "uuid",
          code: d.invalid_string,
          message: a.message
        }), n.dirty());
      else if (a.kind === "nanoid")
        Fe.test(e.data) || (r = this._getOrReturnCtx(e, r), u(r, {
          validation: "nanoid",
          code: d.invalid_string,
          message: a.message
        }), n.dirty());
      else if (a.kind === "cuid")
        ze.test(e.data) || (r = this._getOrReturnCtx(e, r), u(r, {
          validation: "cuid",
          code: d.invalid_string,
          message: a.message
        }), n.dirty());
      else if (a.kind === "cuid2")
        De.test(e.data) || (r = this._getOrReturnCtx(e, r), u(r, {
          validation: "cuid2",
          code: d.invalid_string,
          message: a.message
        }), n.dirty());
      else if (a.kind === "ulid")
        Ue.test(e.data) || (r = this._getOrReturnCtx(e, r), u(r, {
          validation: "ulid",
          code: d.invalid_string,
          message: a.message
        }), n.dirty());
      else if (a.kind === "url")
        try {
          new URL(e.data);
        } catch {
          r = this._getOrReturnCtx(e, r), u(r, {
            validation: "url",
            code: d.invalid_string,
            message: a.message
          }), n.dirty();
        }
      else a.kind === "regex" ? (a.regex.lastIndex = 0, a.regex.test(e.data) || (r = this._getOrReturnCtx(e, r), u(r, {
        validation: "regex",
        code: d.invalid_string,
        message: a.message
      }), n.dirty())) : a.kind === "trim" ? e.data = e.data.trim() : a.kind === "includes" ? e.data.includes(a.value, a.position) || (r = this._getOrReturnCtx(e, r), u(r, {
        code: d.invalid_string,
        validation: { includes: a.value, position: a.position },
        message: a.message
      }), n.dirty()) : a.kind === "toLowerCase" ? e.data = e.data.toLowerCase() : a.kind === "toUpperCase" ? e.data = e.data.toUpperCase() : a.kind === "startsWith" ? e.data.startsWith(a.value) || (r = this._getOrReturnCtx(e, r), u(r, {
        code: d.invalid_string,
        validation: { startsWith: a.value },
        message: a.message
      }), n.dirty()) : a.kind === "endsWith" ? e.data.endsWith(a.value) || (r = this._getOrReturnCtx(e, r), u(r, {
        code: d.invalid_string,
        validation: { endsWith: a.value },
        message: a.message
      }), n.dirty()) : a.kind === "datetime" ? nt(a).test(e.data) || (r = this._getOrReturnCtx(e, r), u(r, {
        code: d.invalid_string,
        validation: "datetime",
        message: a.message
      }), n.dirty()) : a.kind === "date" ? tt.test(e.data) || (r = this._getOrReturnCtx(e, r), u(r, {
        code: d.invalid_string,
        validation: "date",
        message: a.message
      }), n.dirty()) : a.kind === "time" ? st(a).test(e.data) || (r = this._getOrReturnCtx(e, r), u(r, {
        code: d.invalid_string,
        validation: "time",
        message: a.message
      }), n.dirty()) : a.kind === "duration" ? qe.test(e.data) || (r = this._getOrReturnCtx(e, r), u(r, {
        validation: "duration",
        code: d.invalid_string,
        message: a.message
      }), n.dirty()) : a.kind === "ip" ? rt(e.data, a.version) || (r = this._getOrReturnCtx(e, r), u(r, {
        validation: "ip",
        code: d.invalid_string,
        message: a.message
      }), n.dirty()) : a.kind === "jwt" ? at(e.data, a.alg) || (r = this._getOrReturnCtx(e, r), u(r, {
        validation: "jwt",
        code: d.invalid_string,
        message: a.message
      }), n.dirty()) : a.kind === "cidr" ? it(e.data, a.version) || (r = this._getOrReturnCtx(e, r), u(r, {
        validation: "cidr",
        code: d.invalid_string,
        message: a.message
      }), n.dirty()) : a.kind === "base64" ? Ke.test(e.data) || (r = this._getOrReturnCtx(e, r), u(r, {
        validation: "base64",
        code: d.invalid_string,
        message: a.message
      }), n.dirty()) : a.kind === "base64url" ? et.test(e.data) || (r = this._getOrReturnCtx(e, r), u(r, {
        validation: "base64url",
        code: d.invalid_string,
        message: a.message
      }), n.dirty()) : _.assertNever(a);
    return { status: n.value, value: e.data };
  }
  _regex(e, t, n) {
    return this.refinement((r) => e.test(r), {
      validation: t,
      code: d.invalid_string,
      ...h.errToObj(n)
    });
  }
  _addCheck(e) {
    return new j({
      ...this._def,
      checks: [...this._def.checks, e]
    });
  }
  email(e) {
    return this._addCheck({ kind: "email", ...h.errToObj(e) });
  }
  url(e) {
    return this._addCheck({ kind: "url", ...h.errToObj(e) });
  }
  emoji(e) {
    return this._addCheck({ kind: "emoji", ...h.errToObj(e) });
  }
  uuid(e) {
    return this._addCheck({ kind: "uuid", ...h.errToObj(e) });
  }
  nanoid(e) {
    return this._addCheck({ kind: "nanoid", ...h.errToObj(e) });
  }
  cuid(e) {
    return this._addCheck({ kind: "cuid", ...h.errToObj(e) });
  }
  cuid2(e) {
    return this._addCheck({ kind: "cuid2", ...h.errToObj(e) });
  }
  ulid(e) {
    return this._addCheck({ kind: "ulid", ...h.errToObj(e) });
  }
  base64(e) {
    return this._addCheck({ kind: "base64", ...h.errToObj(e) });
  }
  base64url(e) {
    return this._addCheck({
      kind: "base64url",
      ...h.errToObj(e)
    });
  }
  jwt(e) {
    return this._addCheck({ kind: "jwt", ...h.errToObj(e) });
  }
  ip(e) {
    return this._addCheck({ kind: "ip", ...h.errToObj(e) });
  }
  cidr(e) {
    return this._addCheck({ kind: "cidr", ...h.errToObj(e) });
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
      ...h.errToObj(e == null ? void 0 : e.message)
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
      ...h.errToObj(e == null ? void 0 : e.message)
    });
  }
  duration(e) {
    return this._addCheck({ kind: "duration", ...h.errToObj(e) });
  }
  regex(e, t) {
    return this._addCheck({
      kind: "regex",
      regex: e,
      ...h.errToObj(t)
    });
  }
  includes(e, t) {
    return this._addCheck({
      kind: "includes",
      value: e,
      position: t == null ? void 0 : t.position,
      ...h.errToObj(t == null ? void 0 : t.message)
    });
  }
  startsWith(e, t) {
    return this._addCheck({
      kind: "startsWith",
      value: e,
      ...h.errToObj(t)
    });
  }
  endsWith(e, t) {
    return this._addCheck({
      kind: "endsWith",
      value: e,
      ...h.errToObj(t)
    });
  }
  min(e, t) {
    return this._addCheck({
      kind: "min",
      value: e,
      ...h.errToObj(t)
    });
  }
  max(e, t) {
    return this._addCheck({
      kind: "max",
      value: e,
      ...h.errToObj(t)
    });
  }
  length(e, t) {
    return this._addCheck({
      kind: "length",
      value: e,
      ...h.errToObj(t)
    });
  }
  /**
   * Equivalent to `.min(1)`
   */
  nonempty(e) {
    return this.min(1, h.errToObj(e));
  }
  trim() {
    return new j({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }]
    });
  }
  toLowerCase() {
    return new j({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }]
    });
  }
  toUpperCase() {
    return new j({
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
j.create = (s) => new j({
  checks: [],
  typeName: g.ZodString,
  coerce: (s == null ? void 0 : s.coerce) ?? !1,
  ...y(s)
});
function ot(s, e) {
  const t = (s.toString().split(".")[1] || "").length, n = (e.toString().split(".")[1] || "").length, r = t > n ? t : n, a = Number.parseInt(s.toFixed(r).replace(".", "")), i = Number.parseInt(e.toFixed(r).replace(".", ""));
  return a % i / 10 ** r;
}
class W extends v {
  constructor() {
    super(...arguments), this.min = this.gte, this.max = this.lte, this.step = this.multipleOf;
  }
  _parse(e) {
    if (this._def.coerce && (e.data = Number(e.data)), this._getType(e) !== l.number) {
      const a = this._getOrReturnCtx(e);
      return u(a, {
        code: d.invalid_type,
        expected: l.number,
        received: a.parsedType
      }), p;
    }
    let n;
    const r = new T();
    for (const a of this._def.checks)
      a.kind === "int" ? _.isInteger(e.data) || (n = this._getOrReturnCtx(e, n), u(n, {
        code: d.invalid_type,
        expected: "integer",
        received: "float",
        message: a.message
      }), r.dirty()) : a.kind === "min" ? (a.inclusive ? e.data < a.value : e.data <= a.value) && (n = this._getOrReturnCtx(e, n), u(n, {
        code: d.too_small,
        minimum: a.value,
        type: "number",
        inclusive: a.inclusive,
        exact: !1,
        message: a.message
      }), r.dirty()) : a.kind === "max" ? (a.inclusive ? e.data > a.value : e.data >= a.value) && (n = this._getOrReturnCtx(e, n), u(n, {
        code: d.too_big,
        maximum: a.value,
        type: "number",
        inclusive: a.inclusive,
        exact: !1,
        message: a.message
      }), r.dirty()) : a.kind === "multipleOf" ? ot(e.data, a.value) !== 0 && (n = this._getOrReturnCtx(e, n), u(n, {
        code: d.not_multiple_of,
        multipleOf: a.value,
        message: a.message
      }), r.dirty()) : a.kind === "finite" ? Number.isFinite(e.data) || (n = this._getOrReturnCtx(e, n), u(n, {
        code: d.not_finite,
        message: a.message
      }), r.dirty()) : _.assertNever(a);
    return { status: r.value, value: e.data };
  }
  gte(e, t) {
    return this.setLimit("min", e, !0, h.toString(t));
  }
  gt(e, t) {
    return this.setLimit("min", e, !1, h.toString(t));
  }
  lte(e, t) {
    return this.setLimit("max", e, !0, h.toString(t));
  }
  lt(e, t) {
    return this.setLimit("max", e, !1, h.toString(t));
  }
  setLimit(e, t, n, r) {
    return new W({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind: e,
          value: t,
          inclusive: n,
          message: h.toString(r)
        }
      ]
    });
  }
  _addCheck(e) {
    return new W({
      ...this._def,
      checks: [...this._def.checks, e]
    });
  }
  int(e) {
    return this._addCheck({
      kind: "int",
      message: h.toString(e)
    });
  }
  positive(e) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: !1,
      message: h.toString(e)
    });
  }
  negative(e) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: !1,
      message: h.toString(e)
    });
  }
  nonpositive(e) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: !0,
      message: h.toString(e)
    });
  }
  nonnegative(e) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: !0,
      message: h.toString(e)
    });
  }
  multipleOf(e, t) {
    return this._addCheck({
      kind: "multipleOf",
      value: e,
      message: h.toString(t)
    });
  }
  finite(e) {
    return this._addCheck({
      kind: "finite",
      message: h.toString(e)
    });
  }
  safe(e) {
    return this._addCheck({
      kind: "min",
      inclusive: !0,
      value: Number.MIN_SAFE_INTEGER,
      message: h.toString(e)
    })._addCheck({
      kind: "max",
      inclusive: !0,
      value: Number.MAX_SAFE_INTEGER,
      message: h.toString(e)
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
    return !!this._def.checks.find((e) => e.kind === "int" || e.kind === "multipleOf" && _.isInteger(e.value));
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
W.create = (s) => new W({
  checks: [],
  typeName: g.ZodNumber,
  coerce: (s == null ? void 0 : s.coerce) || !1,
  ...y(s)
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
    if (this._getType(e) !== l.bigint)
      return this._getInvalidInput(e);
    let n;
    const r = new T();
    for (const a of this._def.checks)
      a.kind === "min" ? (a.inclusive ? e.data < a.value : e.data <= a.value) && (n = this._getOrReturnCtx(e, n), u(n, {
        code: d.too_small,
        type: "bigint",
        minimum: a.value,
        inclusive: a.inclusive,
        message: a.message
      }), r.dirty()) : a.kind === "max" ? (a.inclusive ? e.data > a.value : e.data >= a.value) && (n = this._getOrReturnCtx(e, n), u(n, {
        code: d.too_big,
        type: "bigint",
        maximum: a.value,
        inclusive: a.inclusive,
        message: a.message
      }), r.dirty()) : a.kind === "multipleOf" ? e.data % a.value !== BigInt(0) && (n = this._getOrReturnCtx(e, n), u(n, {
        code: d.not_multiple_of,
        multipleOf: a.value,
        message: a.message
      }), r.dirty()) : _.assertNever(a);
    return { status: r.value, value: e.data };
  }
  _getInvalidInput(e) {
    const t = this._getOrReturnCtx(e);
    return u(t, {
      code: d.invalid_type,
      expected: l.bigint,
      received: t.parsedType
    }), p;
  }
  gte(e, t) {
    return this.setLimit("min", e, !0, h.toString(t));
  }
  gt(e, t) {
    return this.setLimit("min", e, !1, h.toString(t));
  }
  lte(e, t) {
    return this.setLimit("max", e, !0, h.toString(t));
  }
  lt(e, t) {
    return this.setLimit("max", e, !1, h.toString(t));
  }
  setLimit(e, t, n, r) {
    return new H({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind: e,
          value: t,
          inclusive: n,
          message: h.toString(r)
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
      message: h.toString(e)
    });
  }
  negative(e) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: !1,
      message: h.toString(e)
    });
  }
  nonpositive(e) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: !0,
      message: h.toString(e)
    });
  }
  nonnegative(e) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: !0,
      message: h.toString(e)
    });
  }
  multipleOf(e, t) {
    return this._addCheck({
      kind: "multipleOf",
      value: e,
      message: h.toString(t)
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
H.create = (s) => new H({
  checks: [],
  typeName: g.ZodBigInt,
  coerce: (s == null ? void 0 : s.coerce) ?? !1,
  ...y(s)
});
class ce extends v {
  _parse(e) {
    if (this._def.coerce && (e.data = !!e.data), this._getType(e) !== l.boolean) {
      const n = this._getOrReturnCtx(e);
      return u(n, {
        code: d.invalid_type,
        expected: l.boolean,
        received: n.parsedType
      }), p;
    }
    return O(e.data);
  }
}
ce.create = (s) => new ce({
  typeName: g.ZodBoolean,
  coerce: (s == null ? void 0 : s.coerce) || !1,
  ...y(s)
});
class Q extends v {
  _parse(e) {
    if (this._def.coerce && (e.data = new Date(e.data)), this._getType(e) !== l.date) {
      const a = this._getOrReturnCtx(e);
      return u(a, {
        code: d.invalid_type,
        expected: l.date,
        received: a.parsedType
      }), p;
    }
    if (Number.isNaN(e.data.getTime())) {
      const a = this._getOrReturnCtx(e);
      return u(a, {
        code: d.invalid_date
      }), p;
    }
    const n = new T();
    let r;
    for (const a of this._def.checks)
      a.kind === "min" ? e.data.getTime() < a.value && (r = this._getOrReturnCtx(e, r), u(r, {
        code: d.too_small,
        message: a.message,
        inclusive: !0,
        exact: !1,
        minimum: a.value,
        type: "date"
      }), n.dirty()) : a.kind === "max" ? e.data.getTime() > a.value && (r = this._getOrReturnCtx(e, r), u(r, {
        code: d.too_big,
        message: a.message,
        inclusive: !0,
        exact: !1,
        maximum: a.value,
        type: "date"
      }), n.dirty()) : _.assertNever(a);
    return {
      status: n.value,
      value: new Date(e.data.getTime())
    };
  }
  _addCheck(e) {
    return new Q({
      ...this._def,
      checks: [...this._def.checks, e]
    });
  }
  min(e, t) {
    return this._addCheck({
      kind: "min",
      value: e.getTime(),
      message: h.toString(t)
    });
  }
  max(e, t) {
    return this._addCheck({
      kind: "max",
      value: e.getTime(),
      message: h.toString(t)
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
Q.create = (s) => new Q({
  checks: [],
  coerce: (s == null ? void 0 : s.coerce) || !1,
  typeName: g.ZodDate,
  ...y(s)
});
class be extends v {
  _parse(e) {
    if (this._getType(e) !== l.symbol) {
      const n = this._getOrReturnCtx(e);
      return u(n, {
        code: d.invalid_type,
        expected: l.symbol,
        received: n.parsedType
      }), p;
    }
    return O(e.data);
  }
}
be.create = (s) => new be({
  typeName: g.ZodSymbol,
  ...y(s)
});
class ue extends v {
  _parse(e) {
    if (this._getType(e) !== l.undefined) {
      const n = this._getOrReturnCtx(e);
      return u(n, {
        code: d.invalid_type,
        expected: l.undefined,
        received: n.parsedType
      }), p;
    }
    return O(e.data);
  }
}
ue.create = (s) => new ue({
  typeName: g.ZodUndefined,
  ...y(s)
});
class le extends v {
  _parse(e) {
    if (this._getType(e) !== l.null) {
      const n = this._getOrReturnCtx(e);
      return u(n, {
        code: d.invalid_type,
        expected: l.null,
        received: n.parsedType
      }), p;
    }
    return O(e.data);
  }
}
le.create = (s) => new le({
  typeName: g.ZodNull,
  ...y(s)
});
class we extends v {
  constructor() {
    super(...arguments), this._any = !0;
  }
  _parse(e) {
    return O(e.data);
  }
}
we.create = (s) => new we({
  typeName: g.ZodAny,
  ...y(s)
});
class he extends v {
  constructor() {
    super(...arguments), this._unknown = !0;
  }
  _parse(e) {
    return O(e.data);
  }
}
he.create = (s) => new he({
  typeName: g.ZodUnknown,
  ...y(s)
});
class P extends v {
  _parse(e) {
    const t = this._getOrReturnCtx(e);
    return u(t, {
      code: d.invalid_type,
      expected: l.never,
      received: t.parsedType
    }), p;
  }
}
P.create = (s) => new P({
  typeName: g.ZodNever,
  ...y(s)
});
class Te extends v {
  _parse(e) {
    if (this._getType(e) !== l.undefined) {
      const n = this._getOrReturnCtx(e);
      return u(n, {
        code: d.invalid_type,
        expected: l.void,
        received: n.parsedType
      }), p;
    }
    return O(e.data);
  }
}
Te.create = (s) => new Te({
  typeName: g.ZodVoid,
  ...y(s)
});
class R extends v {
  _parse(e) {
    const { ctx: t, status: n } = this._processInputParams(e), r = this._def;
    if (t.parsedType !== l.array)
      return u(t, {
        code: d.invalid_type,
        expected: l.array,
        received: t.parsedType
      }), p;
    if (r.exactLength !== null) {
      const i = t.data.length > r.exactLength.value, o = t.data.length < r.exactLength.value;
      (i || o) && (u(t, {
        code: i ? d.too_big : d.too_small,
        minimum: o ? r.exactLength.value : void 0,
        maximum: i ? r.exactLength.value : void 0,
        type: "array",
        inclusive: !0,
        exact: !0,
        message: r.exactLength.message
      }), n.dirty());
    }
    if (r.minLength !== null && t.data.length < r.minLength.value && (u(t, {
      code: d.too_small,
      minimum: r.minLength.value,
      type: "array",
      inclusive: !0,
      exact: !1,
      message: r.minLength.message
    }), n.dirty()), r.maxLength !== null && t.data.length > r.maxLength.value && (u(t, {
      code: d.too_big,
      maximum: r.maxLength.value,
      type: "array",
      inclusive: !0,
      exact: !1,
      message: r.maxLength.message
    }), n.dirty()), t.common.async)
      return Promise.all([...t.data].map((i, o) => r.type._parseAsync(new Z(t, i, t.path, o)))).then((i) => T.mergeArray(n, i));
    const a = [...t.data].map((i, o) => r.type._parseSync(new Z(t, i, t.path, o)));
    return T.mergeArray(n, a);
  }
  get element() {
    return this._def.type;
  }
  min(e, t) {
    return new R({
      ...this._def,
      minLength: { value: e, message: h.toString(t) }
    });
  }
  max(e, t) {
    return new R({
      ...this._def,
      maxLength: { value: e, message: h.toString(t) }
    });
  }
  length(e, t) {
    return new R({
      ...this._def,
      exactLength: { value: e, message: h.toString(t) }
    });
  }
  nonempty(e) {
    return this.min(1, e);
  }
}
R.create = (s, e) => new R({
  type: s,
  minLength: null,
  maxLength: null,
  exactLength: null,
  typeName: g.ZodArray,
  ...y(e)
});
function B(s) {
  if (s instanceof w) {
    const e = {};
    for (const t in s.shape) {
      const n = s.shape[t];
      e[t] = $.create(B(n));
    }
    return new w({
      ...s._def,
      shape: () => e
    });
  } else return s instanceof R ? new R({
    ...s._def,
    type: B(s.element)
  }) : s instanceof $ ? $.create(B(s.unwrap())) : s instanceof U ? U.create(B(s.unwrap())) : s instanceof L ? L.create(s.items.map((e) => B(e))) : s;
}
class w extends v {
  constructor() {
    super(...arguments), this._cached = null, this.nonstrict = this.passthrough, this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null)
      return this._cached;
    const e = this._def.shape(), t = _.objectKeys(e);
    return this._cached = { shape: e, keys: t }, this._cached;
  }
  _parse(e) {
    if (this._getType(e) !== l.object) {
      const m = this._getOrReturnCtx(e);
      return u(m, {
        code: d.invalid_type,
        expected: l.object,
        received: m.parsedType
      }), p;
    }
    const { status: n, ctx: r } = this._processInputParams(e), { shape: a, keys: i } = this._getCached(), o = [];
    if (!(this._def.catchall instanceof P && this._def.unknownKeys === "strip"))
      for (const m in r.data)
        i.includes(m) || o.push(m);
    const f = [];
    for (const m of i) {
      const k = a[m], q = r.data[m];
      f.push({
        key: { status: "valid", value: m },
        value: k._parse(new Z(r, q, r.path, m)),
        alwaysSet: m in r.data
      });
    }
    if (this._def.catchall instanceof P) {
      const m = this._def.unknownKeys;
      if (m === "passthrough")
        for (const k of o)
          f.push({
            key: { status: "valid", value: k },
            value: { status: "valid", value: r.data[k] }
          });
      else if (m === "strict")
        o.length > 0 && (u(r, {
          code: d.unrecognized_keys,
          keys: o
        }), n.dirty());
      else if (m !== "strip") throw new Error("Internal ZodObject error: invalid unknownKeys value.");
    } else {
      const m = this._def.catchall;
      for (const k of o) {
        const q = r.data[k];
        f.push({
          key: { status: "valid", value: k },
          value: m._parse(
            new Z(r, q, r.path, k)
            //, ctx.child(key), value, getParsedType(value)
          ),
          alwaysSet: k in r.data
        });
      }
    }
    return r.common.async ? Promise.resolve().then(async () => {
      const m = [];
      for (const k of f) {
        const q = await k.key, je = await k.value;
        m.push({
          key: q,
          value: je,
          alwaysSet: k.alwaysSet
        });
      }
      return m;
    }).then((m) => T.mergeObjectSync(n, m)) : T.mergeObjectSync(n, f);
  }
  get shape() {
    return this._def.shape();
  }
  strict(e) {
    return h.errToObj, new w({
      ...this._def,
      unknownKeys: "strict",
      ...e !== void 0 ? {
        errorMap: (t, n) => {
          var a, i;
          const r = ((i = (a = this._def).errorMap) == null ? void 0 : i.call(a, t, n).message) ?? n.defaultError;
          return t.code === "unrecognized_keys" ? {
            message: h.errToObj(e).message ?? r
          } : {
            message: r
          };
        }
      } : {}
    });
  }
  strip() {
    return new w({
      ...this._def,
      unknownKeys: "strip"
    });
  }
  passthrough() {
    return new w({
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
    return new w({
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
    return new w({
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
    return new w({
      ...this._def,
      catchall: e
    });
  }
  pick(e) {
    const t = {};
    for (const n of _.objectKeys(e))
      e[n] && this.shape[n] && (t[n] = this.shape[n]);
    return new w({
      ...this._def,
      shape: () => t
    });
  }
  omit(e) {
    const t = {};
    for (const n of _.objectKeys(this.shape))
      e[n] || (t[n] = this.shape[n]);
    return new w({
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
    for (const n of _.objectKeys(this.shape)) {
      const r = this.shape[n];
      e && !e[n] ? t[n] = r : t[n] = r.optional();
    }
    return new w({
      ...this._def,
      shape: () => t
    });
  }
  required(e) {
    const t = {};
    for (const n of _.objectKeys(this.shape))
      if (e && !e[n])
        t[n] = this.shape[n];
      else {
        let a = this.shape[n];
        for (; a instanceof $; )
          a = a._def.innerType;
        t[n] = a;
      }
    return new w({
      ...this._def,
      shape: () => t
    });
  }
  keyof() {
    return Ne(_.objectKeys(this.shape));
  }
}
w.create = (s, e) => new w({
  shape: () => s,
  unknownKeys: "strip",
  catchall: P.create(),
  typeName: g.ZodObject,
  ...y(e)
});
w.strictCreate = (s, e) => new w({
  shape: () => s,
  unknownKeys: "strict",
  catchall: P.create(),
  typeName: g.ZodObject,
  ...y(e)
});
w.lazycreate = (s, e) => new w({
  shape: s,
  unknownKeys: "strip",
  catchall: P.create(),
  typeName: g.ZodObject,
  ...y(e)
});
class X extends v {
  _parse(e) {
    const { ctx: t } = this._processInputParams(e), n = this._def.options;
    function r(a) {
      for (const o of a)
        if (o.result.status === "valid")
          return o.result;
      for (const o of a)
        if (o.result.status === "dirty")
          return t.common.issues.push(...o.ctx.common.issues), o.result;
      const i = a.map((o) => new M(o.ctx.common.issues));
      return u(t, {
        code: d.invalid_union,
        unionErrors: i
      }), p;
    }
    if (t.common.async)
      return Promise.all(n.map(async (a) => {
        const i = {
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
            parent: i
          }),
          ctx: i
        };
      })).then(r);
    {
      let a;
      const i = [];
      for (const f of n) {
        const m = {
          ...t,
          common: {
            ...t.common,
            issues: []
          },
          parent: null
        }, k = f._parseSync({
          data: t.data,
          path: t.path,
          parent: m
        });
        if (k.status === "valid")
          return k;
        k.status === "dirty" && !a && (a = { result: k, ctx: m }), m.common.issues.length && i.push(m.common.issues);
      }
      if (a)
        return t.common.issues.push(...a.ctx.common.issues), a.result;
      const o = i.map((f) => new M(f));
      return u(t, {
        code: d.invalid_union,
        unionErrors: o
      }), p;
    }
  }
  get options() {
    return this._def.options;
  }
}
X.create = (s, e) => new X({
  options: s,
  typeName: g.ZodUnion,
  ...y(e)
});
const E = (s) => s instanceof me ? E(s.schema) : s instanceof D ? E(s.innerType()) : s instanceof te ? [s.value] : s instanceof z ? s.options : s instanceof pe ? _.objectValues(s.enum) : s instanceof ne ? E(s._def.innerType) : s instanceof ue ? [void 0] : s instanceof le ? [null] : s instanceof $ ? [void 0, ...E(s.unwrap())] : s instanceof U ? [null, ...E(s.unwrap())] : s instanceof Re || s instanceof ae ? E(s.unwrap()) : s instanceof re ? E(s._def.innerType) : [];
class ge extends v {
  _parse(e) {
    const { ctx: t } = this._processInputParams(e);
    if (t.parsedType !== l.object)
      return u(t, {
        code: d.invalid_type,
        expected: l.object,
        received: t.parsedType
      }), p;
    const n = this.discriminator, r = t.data[n], a = this.optionsMap.get(r);
    return a ? t.common.async ? a._parseAsync({
      data: t.data,
      path: t.path,
      parent: t
    }) : a._parseSync({
      data: t.data,
      path: t.path,
      parent: t
    }) : (u(t, {
      code: d.invalid_union_discriminator,
      options: Array.from(this.optionsMap.keys()),
      path: [n]
    }), p);
  }
  get discriminator() {
    return this._def.discriminator;
  }
  get options() {
    return this._def.options;
  }
  get optionsMap() {
    return this._def.optionsMap;
  }
  /**
   * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
   * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
   * have a different value for each object in the union.
   * @param discriminator the name of the discriminator property
   * @param types an array of object schemas
   * @param params
   */
  static create(e, t, n) {
    const r = /* @__PURE__ */ new Map();
    for (const a of t) {
      const i = E(a.shape[e]);
      if (!i.length)
        throw new Error(`A discriminator value for key \`${e}\` could not be extracted from all schema options`);
      for (const o of i) {
        if (r.has(o))
          throw new Error(`Discriminator property ${String(e)} has duplicate value ${String(o)}`);
        r.set(o, a);
      }
    }
    return new ge({
      typeName: g.ZodDiscriminatedUnion,
      discriminator: e,
      options: t,
      optionsMap: r,
      ...y(n)
    });
  }
}
function fe(s, e) {
  const t = V(s), n = V(e);
  if (s === e)
    return { valid: !0, data: s };
  if (t === l.object && n === l.object) {
    const r = _.objectKeys(e), a = _.objectKeys(s).filter((o) => r.indexOf(o) !== -1), i = { ...s, ...e };
    for (const o of a) {
      const f = fe(s[o], e[o]);
      if (!f.valid)
        return { valid: !1 };
      i[o] = f.data;
    }
    return { valid: !0, data: i };
  } else if (t === l.array && n === l.array) {
    if (s.length !== e.length)
      return { valid: !1 };
    const r = [];
    for (let a = 0; a < s.length; a++) {
      const i = s[a], o = e[a], f = fe(i, o);
      if (!f.valid)
        return { valid: !1 };
      r.push(f.data);
    }
    return { valid: !0, data: r };
  } else return t === l.date && n === l.date && +s == +e ? { valid: !0, data: s } : { valid: !1 };
}
class K extends v {
  _parse(e) {
    const { status: t, ctx: n } = this._processInputParams(e), r = (a, i) => {
      if (_e(a) || _e(i))
        return p;
      const o = fe(a.value, i.value);
      return o.valid ? ((ke(a) || ke(i)) && t.dirty(), { status: t.value, value: o.data }) : (u(n, {
        code: d.invalid_intersection_types
      }), p);
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
    ]).then(([a, i]) => r(a, i)) : r(this._def.left._parseSync({
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
K.create = (s, e, t) => new K({
  left: s,
  right: e,
  typeName: g.ZodIntersection,
  ...y(t)
});
class L extends v {
  _parse(e) {
    const { status: t, ctx: n } = this._processInputParams(e);
    if (n.parsedType !== l.array)
      return u(n, {
        code: d.invalid_type,
        expected: l.array,
        received: n.parsedType
      }), p;
    if (n.data.length < this._def.items.length)
      return u(n, {
        code: d.too_small,
        minimum: this._def.items.length,
        inclusive: !0,
        exact: !1,
        type: "array"
      }), p;
    !this._def.rest && n.data.length > this._def.items.length && (u(n, {
      code: d.too_big,
      maximum: this._def.items.length,
      inclusive: !0,
      exact: !1,
      type: "array"
    }), t.dirty());
    const a = [...n.data].map((i, o) => {
      const f = this._def.items[o] || this._def.rest;
      return f ? f._parse(new Z(n, i, n.path, o)) : null;
    }).filter((i) => !!i);
    return n.common.async ? Promise.all(a).then((i) => T.mergeArray(t, i)) : T.mergeArray(t, a);
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
L.create = (s, e) => {
  if (!Array.isArray(s))
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  return new L({
    items: s,
    typeName: g.ZodTuple,
    rest: null,
    ...y(e)
  });
};
class ee extends v {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(e) {
    const { status: t, ctx: n } = this._processInputParams(e);
    if (n.parsedType !== l.object)
      return u(n, {
        code: d.invalid_type,
        expected: l.object,
        received: n.parsedType
      }), p;
    const r = [], a = this._def.keyType, i = this._def.valueType;
    for (const o in n.data)
      r.push({
        key: a._parse(new Z(n, o, n.path, o)),
        value: i._parse(new Z(n, n.data[o], n.path, o)),
        alwaysSet: o in n.data
      });
    return n.common.async ? T.mergeObjectAsync(t, r) : T.mergeObjectSync(t, r);
  }
  get element() {
    return this._def.valueType;
  }
  static create(e, t, n) {
    return t instanceof v ? new ee({
      keyType: e,
      valueType: t,
      typeName: g.ZodRecord,
      ...y(n)
    }) : new ee({
      keyType: j.create(),
      valueType: e,
      typeName: g.ZodRecord,
      ...y(t)
    });
  }
}
class Se extends v {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(e) {
    const { status: t, ctx: n } = this._processInputParams(e);
    if (n.parsedType !== l.map)
      return u(n, {
        code: d.invalid_type,
        expected: l.map,
        received: n.parsedType
      }), p;
    const r = this._def.keyType, a = this._def.valueType, i = [...n.data.entries()].map(([o, f], m) => ({
      key: r._parse(new Z(n, o, n.path, [m, "key"])),
      value: a._parse(new Z(n, f, n.path, [m, "value"]))
    }));
    if (n.common.async) {
      const o = /* @__PURE__ */ new Map();
      return Promise.resolve().then(async () => {
        for (const f of i) {
          const m = await f.key, k = await f.value;
          if (m.status === "aborted" || k.status === "aborted")
            return p;
          (m.status === "dirty" || k.status === "dirty") && t.dirty(), o.set(m.value, k.value);
        }
        return { status: t.value, value: o };
      });
    } else {
      const o = /* @__PURE__ */ new Map();
      for (const f of i) {
        const m = f.key, k = f.value;
        if (m.status === "aborted" || k.status === "aborted")
          return p;
        (m.status === "dirty" || k.status === "dirty") && t.dirty(), o.set(m.value, k.value);
      }
      return { status: t.value, value: o };
    }
  }
}
Se.create = (s, e, t) => new Se({
  valueType: e,
  keyType: s,
  typeName: g.ZodMap,
  ...y(t)
});
class Y extends v {
  _parse(e) {
    const { status: t, ctx: n } = this._processInputParams(e);
    if (n.parsedType !== l.set)
      return u(n, {
        code: d.invalid_type,
        expected: l.set,
        received: n.parsedType
      }), p;
    const r = this._def;
    r.minSize !== null && n.data.size < r.minSize.value && (u(n, {
      code: d.too_small,
      minimum: r.minSize.value,
      type: "set",
      inclusive: !0,
      exact: !1,
      message: r.minSize.message
    }), t.dirty()), r.maxSize !== null && n.data.size > r.maxSize.value && (u(n, {
      code: d.too_big,
      maximum: r.maxSize.value,
      type: "set",
      inclusive: !0,
      exact: !1,
      message: r.maxSize.message
    }), t.dirty());
    const a = this._def.valueType;
    function i(f) {
      const m = /* @__PURE__ */ new Set();
      for (const k of f) {
        if (k.status === "aborted")
          return p;
        k.status === "dirty" && t.dirty(), m.add(k.value);
      }
      return { status: t.value, value: m };
    }
    const o = [...n.data.values()].map((f, m) => a._parse(new Z(n, f, n.path, m)));
    return n.common.async ? Promise.all(o).then((f) => i(f)) : i(o);
  }
  min(e, t) {
    return new Y({
      ...this._def,
      minSize: { value: e, message: h.toString(t) }
    });
  }
  max(e, t) {
    return new Y({
      ...this._def,
      maxSize: { value: e, message: h.toString(t) }
    });
  }
  size(e, t) {
    return this.min(e, t).max(e, t);
  }
  nonempty(e) {
    return this.min(1, e);
  }
}
Y.create = (s, e) => new Y({
  valueType: s,
  minSize: null,
  maxSize: null,
  typeName: g.ZodSet,
  ...y(e)
});
class me extends v {
  get schema() {
    return this._def.getter();
  }
  _parse(e) {
    const { ctx: t } = this._processInputParams(e);
    return this._def.getter()._parse({ data: t.data, path: t.path, parent: t });
  }
}
me.create = (s, e) => new me({
  getter: s,
  typeName: g.ZodLazy,
  ...y(e)
});
class te extends v {
  _parse(e) {
    if (e.data !== this._def.value) {
      const t = this._getOrReturnCtx(e);
      return u(t, {
        received: t.data,
        code: d.invalid_literal,
        expected: this._def.value
      }), p;
    }
    return { status: "valid", value: e.data };
  }
  get value() {
    return this._def.value;
  }
}
te.create = (s, e) => new te({
  value: s,
  typeName: g.ZodLiteral,
  ...y(e)
});
function Ne(s, e) {
  return new z({
    values: s,
    typeName: g.ZodEnum,
    ...y(e)
  });
}
class z extends v {
  _parse(e) {
    if (typeof e.data != "string") {
      const t = this._getOrReturnCtx(e), n = this._def.values;
      return u(t, {
        expected: _.joinValues(n),
        received: t.parsedType,
        code: d.invalid_type
      }), p;
    }
    if (this._cache || (this._cache = new Set(this._def.values)), !this._cache.has(e.data)) {
      const t = this._getOrReturnCtx(e), n = this._def.values;
      return u(t, {
        received: t.data,
        code: d.invalid_enum_value,
        options: n
      }), p;
    }
    return O(e.data);
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
    return z.create(e, {
      ...this._def,
      ...t
    });
  }
  exclude(e, t = this._def) {
    return z.create(this.options.filter((n) => !e.includes(n)), {
      ...this._def,
      ...t
    });
  }
}
z.create = Ne;
class pe extends v {
  _parse(e) {
    const t = _.getValidEnumValues(this._def.values), n = this._getOrReturnCtx(e);
    if (n.parsedType !== l.string && n.parsedType !== l.number) {
      const r = _.objectValues(t);
      return u(n, {
        expected: _.joinValues(r),
        received: n.parsedType,
        code: d.invalid_type
      }), p;
    }
    if (this._cache || (this._cache = new Set(_.getValidEnumValues(this._def.values))), !this._cache.has(e.data)) {
      const r = _.objectValues(t);
      return u(n, {
        received: n.data,
        code: d.invalid_enum_value,
        options: r
      }), p;
    }
    return O(e.data);
  }
  get enum() {
    return this._def.values;
  }
}
pe.create = (s, e) => new pe({
  values: s,
  typeName: g.ZodNativeEnum,
  ...y(e)
});
class se extends v {
  unwrap() {
    return this._def.type;
  }
  _parse(e) {
    const { ctx: t } = this._processInputParams(e);
    if (t.parsedType !== l.promise && t.common.async === !1)
      return u(t, {
        code: d.invalid_type,
        expected: l.promise,
        received: t.parsedType
      }), p;
    const n = t.parsedType === l.promise ? t.data : Promise.resolve(t.data);
    return O(n.then((r) => this._def.type.parseAsync(r, {
      path: t.path,
      errorMap: t.common.contextualErrorMap
    })));
  }
}
se.create = (s, e) => new se({
  type: s,
  typeName: g.ZodPromise,
  ...y(e)
});
class D extends v {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === g.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(e) {
    const { status: t, ctx: n } = this._processInputParams(e), r = this._def.effect || null, a = {
      addIssue: (i) => {
        u(n, i), i.fatal ? t.abort() : t.dirty();
      },
      get path() {
        return n.path;
      }
    };
    if (a.addIssue = a.addIssue.bind(a), r.type === "preprocess") {
      const i = r.transform(n.data, a);
      if (n.common.async)
        return Promise.resolve(i).then(async (o) => {
          if (t.value === "aborted")
            return p;
          const f = await this._def.schema._parseAsync({
            data: o,
            path: n.path,
            parent: n
          });
          return f.status === "aborted" ? p : f.status === "dirty" || t.value === "dirty" ? J(f.value) : f;
        });
      {
        if (t.value === "aborted")
          return p;
        const o = this._def.schema._parseSync({
          data: i,
          path: n.path,
          parent: n
        });
        return o.status === "aborted" ? p : o.status === "dirty" || t.value === "dirty" ? J(o.value) : o;
      }
    }
    if (r.type === "refinement") {
      const i = (o) => {
        const f = r.refinement(o, a);
        if (n.common.async)
          return Promise.resolve(f);
        if (f instanceof Promise)
          throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        return o;
      };
      if (n.common.async === !1) {
        const o = this._def.schema._parseSync({
          data: n.data,
          path: n.path,
          parent: n
        });
        return o.status === "aborted" ? p : (o.status === "dirty" && t.dirty(), i(o.value), { status: t.value, value: o.value });
      } else
        return this._def.schema._parseAsync({ data: n.data, path: n.path, parent: n }).then((o) => o.status === "aborted" ? p : (o.status === "dirty" && t.dirty(), i(o.value).then(() => ({ status: t.value, value: o.value }))));
    }
    if (r.type === "transform")
      if (n.common.async === !1) {
        const i = this._def.schema._parseSync({
          data: n.data,
          path: n.path,
          parent: n
        });
        if (!F(i))
          return p;
        const o = r.transform(i.value, a);
        if (o instanceof Promise)
          throw new Error("Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.");
        return { status: t.value, value: o };
      } else
        return this._def.schema._parseAsync({ data: n.data, path: n.path, parent: n }).then((i) => F(i) ? Promise.resolve(r.transform(i.value, a)).then((o) => ({
          status: t.value,
          value: o
        })) : p);
    _.assertNever(r);
  }
}
D.create = (s, e, t) => new D({
  schema: s,
  typeName: g.ZodEffects,
  effect: e,
  ...y(t)
});
D.createWithPreprocess = (s, e, t) => new D({
  schema: e,
  effect: { type: "preprocess", transform: s },
  typeName: g.ZodEffects,
  ...y(t)
});
class $ extends v {
  _parse(e) {
    return this._getType(e) === l.undefined ? O(void 0) : this._def.innerType._parse(e);
  }
  unwrap() {
    return this._def.innerType;
  }
}
$.create = (s, e) => new $({
  innerType: s,
  typeName: g.ZodOptional,
  ...y(e)
});
class U extends v {
  _parse(e) {
    return this._getType(e) === l.null ? O(null) : this._def.innerType._parse(e);
  }
  unwrap() {
    return this._def.innerType;
  }
}
U.create = (s, e) => new U({
  innerType: s,
  typeName: g.ZodNullable,
  ...y(e)
});
class ne extends v {
  _parse(e) {
    const { ctx: t } = this._processInputParams(e);
    let n = t.data;
    return t.parsedType === l.undefined && (n = this._def.defaultValue()), this._def.innerType._parse({
      data: n,
      path: t.path,
      parent: t
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
}
ne.create = (s, e) => new ne({
  innerType: s,
  typeName: g.ZodDefault,
  defaultValue: typeof e.default == "function" ? e.default : () => e.default,
  ...y(e)
});
class re extends v {
  _parse(e) {
    const { ctx: t } = this._processInputParams(e), n = {
      ...t,
      common: {
        ...t.common,
        issues: []
      }
    }, r = this._def.innerType._parse({
      data: n.data,
      path: n.path,
      parent: {
        ...n
      }
    });
    return G(r) ? r.then((a) => ({
      status: "valid",
      value: a.status === "valid" ? a.value : this._def.catchValue({
        get error() {
          return new M(n.common.issues);
        },
        input: n.data
      })
    })) : {
      status: "valid",
      value: r.status === "valid" ? r.value : this._def.catchValue({
        get error() {
          return new M(n.common.issues);
        },
        input: n.data
      })
    };
  }
  removeCatch() {
    return this._def.innerType;
  }
}
re.create = (s, e) => new re({
  innerType: s,
  typeName: g.ZodCatch,
  catchValue: typeof e.catch == "function" ? e.catch : () => e.catch,
  ...y(e)
});
class Ce extends v {
  _parse(e) {
    if (this._getType(e) !== l.nan) {
      const n = this._getOrReturnCtx(e);
      return u(n, {
        code: d.invalid_type,
        expected: l.nan,
        received: n.parsedType
      }), p;
    }
    return { status: "valid", value: e.data };
  }
}
Ce.create = (s) => new Ce({
  typeName: g.ZodNaN,
  ...y(s)
});
class Re extends v {
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
class ye extends v {
  _parse(e) {
    const { status: t, ctx: n } = this._processInputParams(e);
    if (n.common.async)
      return (async () => {
        const a = await this._def.in._parseAsync({
          data: n.data,
          path: n.path,
          parent: n
        });
        return a.status === "aborted" ? p : a.status === "dirty" ? (t.dirty(), J(a.value)) : this._def.out._parseAsync({
          data: a.value,
          path: n.path,
          parent: n
        });
      })();
    {
      const r = this._def.in._parseSync({
        data: n.data,
        path: n.path,
        parent: n
      });
      return r.status === "aborted" ? p : r.status === "dirty" ? (t.dirty(), {
        status: "dirty",
        value: r.value
      }) : this._def.out._parseSync({
        data: r.value,
        path: n.path,
        parent: n
      });
    }
  }
  static create(e, t) {
    return new ye({
      in: e,
      out: t,
      typeName: g.ZodPipeline
    });
  }
}
class ae extends v {
  _parse(e) {
    const t = this._def.innerType._parse(e), n = (r) => (F(r) && (r.value = Object.freeze(r.value)), r);
    return G(t) ? t.then((r) => n(r)) : n(t);
  }
  unwrap() {
    return this._def.innerType;
  }
}
ae.create = (s, e) => new ae({
  innerType: s,
  typeName: g.ZodReadonly,
  ...y(e)
});
var g;
(function(s) {
  s.ZodString = "ZodString", s.ZodNumber = "ZodNumber", s.ZodNaN = "ZodNaN", s.ZodBigInt = "ZodBigInt", s.ZodBoolean = "ZodBoolean", s.ZodDate = "ZodDate", s.ZodSymbol = "ZodSymbol", s.ZodUndefined = "ZodUndefined", s.ZodNull = "ZodNull", s.ZodAny = "ZodAny", s.ZodUnknown = "ZodUnknown", s.ZodNever = "ZodNever", s.ZodVoid = "ZodVoid", s.ZodArray = "ZodArray", s.ZodObject = "ZodObject", s.ZodUnion = "ZodUnion", s.ZodDiscriminatedUnion = "ZodDiscriminatedUnion", s.ZodIntersection = "ZodIntersection", s.ZodTuple = "ZodTuple", s.ZodRecord = "ZodRecord", s.ZodMap = "ZodMap", s.ZodSet = "ZodSet", s.ZodFunction = "ZodFunction", s.ZodLazy = "ZodLazy", s.ZodLiteral = "ZodLiteral", s.ZodEnum = "ZodEnum", s.ZodEffects = "ZodEffects", s.ZodNativeEnum = "ZodNativeEnum", s.ZodOptional = "ZodOptional", s.ZodNullable = "ZodNullable", s.ZodDefault = "ZodDefault", s.ZodCatch = "ZodCatch", s.ZodPromise = "ZodPromise", s.ZodBranded = "ZodBranded", s.ZodPipeline = "ZodPipeline", s.ZodReadonly = "ZodReadonly";
})(g || (g = {}));
const c = j.create, b = W.create, Ae = ce.create, Ze = he.create;
P.create;
const dt = R.create, x = w.create;
X.create;
const Ee = ge.create;
K.create;
L.create;
const oe = ee.create, A = te.create, I = z.create;
se.create;
$.create;
U.create;
const ct = [
  "ingest",
  "normalize",
  "scene-detect",
  "dedup",
  "asr",
  "vision",
  "graph",
  "reason"
], N = I(ct), ut = Ee("type", [
  x({ type: A("run:start"), runId: c(), at: b() }),
  x({ type: A("stage:start"), runId: c(), stage: N, attempt: b().int().min(1) }),
  x({ type: A("stage:resumed"), runId: c(), stage: N }),
  // A stage that will never run for THIS source — no frames to dedup, no
  // backend to see them. Distinct from "waiting", which a user reads as
  // "still to come" and which never resolves.
  x({ type: A("stage:skipped"), runId: c(), stage: N, why: c() }),
  x({
    type: A("stage:progress"),
    runId: c(),
    stage: N,
    done: b().int().min(0),
    total: b().int().min(0),
    note: c().optional()
  }),
  x({ type: A("stage:done"), runId: c(), stage: N, ms: b().min(0) }),
  x({
    type: A("stage:degraded"),
    runId: c(),
    stage: N,
    code: c(),
    message: c()
  }),
  x({ type: A("run:done"), runId: c(), ms: b().min(0) }),
  x({
    type: A("run:failed"),
    runId: c(),
    stage: N.nullable(),
    code: c(),
    message: c()
  }),
  x({ type: A("run:cancelled"), runId: c(), stage: N.nullable() })
]), lt = I(["url", "file"]), ht = I(["claimed", "running", "succeeded", "failed", "cancelled"]), ft = I(["audio", "visual", "both"]);
x({
  id: c(),
  kind: lt,
  uri: c(),
  contentSha256: c().length(64).nullable(),
  title: c().nullable(),
  durationS: b().positive().nullable(),
  hasAudio: Ae(),
  hasVideo: Ae(),
  createdAt: b().int()
});
x({
  id: c(),
  sourceId: c(),
  schemaRevisionId: c().nullable(),
  status: ht,
  stagePointer: N.nullable(),
  errorCode: c().nullable(),
  errorMessage: c().nullable(),
  leaseOwner: c().nullable(),
  leaseExpiresAt: b().int().nullable(),
  createdAt: b().int(),
  startedAt: b().int().nullable(),
  finishedAt: b().int().nullable()
});
x({
  runId: c(),
  stage: N,
  attempt: b().int().min(1),
  inputHash: c(),
  status: I(["running", "done", "failed", "degraded"]),
  errorCode: c().nullable(),
  errorMessage: c().nullable(),
  startedAt: b().int(),
  finishedAt: b().int().nullable()
});
x({
  id: c(),
  runId: c(),
  kind: c(),
  relPath: c(),
  sha256: c().length(64),
  bytes: b().int().min(0),
  contentType: c(),
  createdAt: b().int()
});
x({
  id: c(),
  runId: c(),
  modality: ft,
  sourceRef: c(),
  tStart: b().min(0),
  tEnd: b().min(0),
  quote: c().nullable(),
  nodeKey: c().nullable()
});
x({
  observationId: c(),
  runId: c(),
  fieldPath: c(),
  valueJson: c(),
  propositionKey: c().nullable(),
  retractsObservationId: c().nullable(),
  createdAt: b().int()
});
x({
  observationId: c(),
  evidenceCoverage: I(["none", "single", "multiple"]),
  evidenceModalities: b().int().min(0).max(2),
  evidenceQuality: I(["verbatim", "ocr_uncertain", "inferred"]),
  consistency: I(["agree", "conflict", "retracted"]),
  mappingStatus: I(["matched", "provisional", "unmapped"]),
  /** Queue order only. Higher means "a human should look sooner". Never shown as a percentage. */
  reviewPriority: b().int(),
  priorityVersion: b().int().min(1)
});
x({
  id: c(),
  observationId: c(),
  decision: I(["approved", "rejected", "reopened"]),
  actor: c(),
  note: c().nullable(),
  schemaRevisionId: c().nullable(),
  createdAt: b().int()
});
x({
  runId: c(),
  sourceSha256: c().nullable(),
  schemaRevisionId: c().nullable(),
  schemaJson: c().nullable(),
  prompts: oe(c(), c()),
  asrEngine: c().nullable(),
  asrModel: c().nullable(),
  inferenceBackend: c().nullable(),
  inferenceModel: c().nullable(),
  backendVersion: c().nullable(),
  dependencyVersions: oe(c(), c()),
  settings: oe(c(), Ze()),
  createdAt: b().int()
});
x({
  source: c().min(1),
  schemaJson: c().nullable(),
  backendId: c().nullable(),
  /** Which stored revision this run was asked with, when it came from one. */
  schemaRevisionId: c().nullable().optional()
});
x({ runId: c().min(1) });
x({ source: c().min(1) });
const mt = x({
  name: c(),
  kind: I(["text", "list", "number", "date"]),
  description: c().optional()
});
x({
  schemaId: c().optional(),
  name: c().min(1),
  description: c().optional(),
  fields: dt(mt)
});
x({ schemaId: c().min(1) });
Ee("kind", [
  x({ kind: A("event"), event: ut }),
  x({ kind: A("done"), runId: c(), summary: Ze() }),
  x({
    kind: A("failed"),
    runId: c(),
    error: x({ code: c(), message: c() })
  })
]);
const C = {
  doctor: "lirovo:doctor",
  extract: "lirovo:extract",
  cancel: "lirovo:cancel",
  runDetail: "lirovo:run-detail",
  listRuns: "lirovo:list-runs",
  pickFile: "lirovo:pick-file",
  inspect: "lirovo:inspect",
  listSchemas: "lirovo:list-schemas",
  saveSchema: "lirovo:save-schema",
  schemaRevisions: "lirovo:schema-revisions",
  archiveSchema: "lirovo:archive-schema",
  engineEvent: "lirovo:engine-event"
}, pt = {
  doctor: () => S.invoke(C.doctor),
  listRuns: () => S.invoke(C.listRuns),
  runDetail: (s) => S.invoke(C.runDetail, { runId: s }),
  extract: (s) => S.invoke(C.extract, s),
  cancel: () => S.invoke(C.cancel),
  inspect: (s) => S.invoke(C.inspect, { source: s }),
  listSchemas: () => S.invoke(C.listSchemas),
  saveSchema: (s) => S.invoke(C.saveSchema, s),
  schemaRevisions: (s) => S.invoke(C.schemaRevisions, { schemaId: s }),
  archiveSchema: (s) => S.invoke(C.archiveSchema, { schemaId: s }),
  pickFile: () => S.invoke(C.pickFile),
  /**
   * A dropped file gives the renderer a File object with no path. This is the
   * only place the real one is knowable, and it is the difference between
   * ffmpeg reading the video and ffmpeg reading nothing.
   */
  pathForFile: (s) => Me.getPathForFile(s),
  /**
   * Returns its own unsubscribe rather than exposing removeListener, so one
   * component cannot detach another's handler.
   */
  onEngineEvent: (s) => {
    const e = (t, n) => s(n);
    return S.on(C.engineEvent, e), () => {
      S.removeListener(C.engineEvent, e);
    };
  }
};
$e.exposeInMainWorld("lirovo", pt);
