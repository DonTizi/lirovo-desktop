import { randomUUID as Je } from "node:crypto";
import te from "node:path";
import { fileURLToPath as He } from "node:url";
import { app as ne, ipcMain as A, BrowserWindow as Le, shell as Ye, dialog as Ge, utilityProcess as Qe } from "electron";
var _;
(function(n) {
  n.assertEqual = (r) => {
  };
  function e(r) {
  }
  n.assertIs = e;
  function t(r) {
    throw new Error();
  }
  n.assertNever = t, n.arrayToEnum = (r) => {
    const a = {};
    for (const i of r)
      a[i] = i;
    return a;
  }, n.getValidEnumValues = (r) => {
    const a = n.objectKeys(r).filter((o) => typeof r[r[o]] != "number"), i = {};
    for (const o of a)
      i[o] = r[o];
    return n.objectValues(i);
  }, n.objectValues = (r) => n.objectKeys(r).map(function(a) {
    return r[a];
  }), n.objectKeys = typeof Object.keys == "function" ? (r) => Object.keys(r) : (r) => {
    const a = [];
    for (const i in r)
      Object.prototype.hasOwnProperty.call(r, i) && a.push(i);
    return a;
  }, n.find = (r, a) => {
    for (const i of r)
      if (a(i))
        return i;
  }, n.isInteger = typeof Number.isInteger == "function" ? (r) => Number.isInteger(r) : (r) => typeof r == "number" && Number.isFinite(r) && Math.floor(r) === r;
  function s(r, a = " | ") {
    return r.map((i) => typeof i == "string" ? `'${i}'` : i).join(a);
  }
  n.joinValues = s, n.jsonStringifyReplacer = (r, a) => typeof a == "bigint" ? a.toString() : a;
})(_ || (_ = {}));
var Ce;
(function(n) {
  n.mergeShapes = (e, t) => ({
    ...e,
    ...t
    // second overwrites first
  });
})(Ce || (Ce = {}));
const u = _.arrayToEnum([
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
]), D = (n) => {
  switch (typeof n) {
    case "undefined":
      return u.undefined;
    case "string":
      return u.string;
    case "number":
      return Number.isNaN(n) ? u.nan : u.number;
    case "boolean":
      return u.boolean;
    case "function":
      return u.function;
    case "bigint":
      return u.bigint;
    case "symbol":
      return u.symbol;
    case "object":
      return Array.isArray(n) ? u.array : n === null ? u.null : n.then && typeof n.then == "function" && n.catch && typeof n.catch == "function" ? u.promise : typeof Map < "u" && n instanceof Map ? u.map : typeof Set < "u" && n instanceof Set ? u.set : typeof Date < "u" && n instanceof Date ? u.date : u.object;
    default:
      return u.unknown;
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
class L extends Error {
  get errors() {
    return this.issues;
  }
  constructor(e) {
    super(), this.issues = [], this.addIssue = (s) => {
      this.issues = [...this.issues, s];
    }, this.addIssues = (s = []) => {
      this.issues = [...this.issues, ...s];
    };
    const t = new.target.prototype;
    Object.setPrototypeOf ? Object.setPrototypeOf(this, t) : this.__proto__ = t, this.name = "ZodError", this.issues = e;
  }
  format(e) {
    const t = e || function(a) {
      return a.message;
    }, s = { _errors: [] }, r = (a) => {
      for (const i of a.issues)
        if (i.code === "invalid_union")
          i.unionErrors.map(r);
        else if (i.code === "invalid_return_type")
          r(i.returnTypeError);
        else if (i.code === "invalid_arguments")
          r(i.argumentsError);
        else if (i.path.length === 0)
          s._errors.push(t(i));
        else {
          let o = s, f = 0;
          for (; f < i.path.length; ) {
            const m = i.path[f];
            f === i.path.length - 1 ? (o[m] = o[m] || { _errors: [] }, o[m]._errors.push(t(i))) : o[m] = o[m] || { _errors: [] }, o = o[m], f++;
          }
        }
    };
    return r(this), s;
  }
  static assert(e) {
    if (!(e instanceof L))
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
    const t = {}, s = [];
    for (const r of this.issues)
      if (r.path.length > 0) {
        const a = r.path[0];
        t[a] = t[a] || [], t[a].push(e(r));
      } else
        s.push(e(r));
    return { formErrors: s, fieldErrors: t };
  }
  get formErrors() {
    return this.flatten();
  }
}
L.create = (n) => new L(n);
const pe = (n, e) => {
  let t;
  switch (n.code) {
    case d.invalid_type:
      n.received === u.undefined ? t = "Required" : t = `Expected ${n.expected}, received ${n.received}`;
      break;
    case d.invalid_literal:
      t = `Invalid literal value, expected ${JSON.stringify(n.expected, _.jsonStringifyReplacer)}`;
      break;
    case d.unrecognized_keys:
      t = `Unrecognized key(s) in object: ${_.joinValues(n.keys, ", ")}`;
      break;
    case d.invalid_union:
      t = "Invalid input";
      break;
    case d.invalid_union_discriminator:
      t = `Invalid discriminator value. Expected ${_.joinValues(n.options)}`;
      break;
    case d.invalid_enum_value:
      t = `Invalid enum value. Expected ${_.joinValues(n.options)}, received '${n.received}'`;
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
      typeof n.validation == "object" ? "includes" in n.validation ? (t = `Invalid input: must include "${n.validation.includes}"`, typeof n.validation.position == "number" && (t = `${t} at one or more positions greater than or equal to ${n.validation.position}`)) : "startsWith" in n.validation ? t = `Invalid input: must start with "${n.validation.startsWith}"` : "endsWith" in n.validation ? t = `Invalid input: must end with "${n.validation.endsWith}"` : _.assertNever(n.validation) : n.validation !== "regex" ? t = `Invalid ${n.validation}` : t = "Invalid";
      break;
    case d.too_small:
      n.type === "array" ? t = `Array must contain ${n.exact ? "exactly" : n.inclusive ? "at least" : "more than"} ${n.minimum} element(s)` : n.type === "string" ? t = `String must contain ${n.exact ? "exactly" : n.inclusive ? "at least" : "over"} ${n.minimum} character(s)` : n.type === "number" ? t = `Number must be ${n.exact ? "exactly equal to " : n.inclusive ? "greater than or equal to " : "greater than "}${n.minimum}` : n.type === "bigint" ? t = `Number must be ${n.exact ? "exactly equal to " : n.inclusive ? "greater than or equal to " : "greater than "}${n.minimum}` : n.type === "date" ? t = `Date must be ${n.exact ? "exactly equal to " : n.inclusive ? "greater than or equal to " : "greater than "}${new Date(Number(n.minimum))}` : t = "Invalid input";
      break;
    case d.too_big:
      n.type === "array" ? t = `Array must contain ${n.exact ? "exactly" : n.inclusive ? "at most" : "less than"} ${n.maximum} element(s)` : n.type === "string" ? t = `String must contain ${n.exact ? "exactly" : n.inclusive ? "at most" : "under"} ${n.maximum} character(s)` : n.type === "number" ? t = `Number must be ${n.exact ? "exactly" : n.inclusive ? "less than or equal to" : "less than"} ${n.maximum}` : n.type === "bigint" ? t = `BigInt must be ${n.exact ? "exactly" : n.inclusive ? "less than or equal to" : "less than"} ${n.maximum}` : n.type === "date" ? t = `Date must be ${n.exact ? "exactly" : n.inclusive ? "smaller than or equal to" : "smaller than"} ${new Date(Number(n.maximum))}` : t = "Invalid input";
      break;
    case d.custom:
      t = "Invalid input";
      break;
    case d.invalid_intersection_types:
      t = "Intersection results could not be merged";
      break;
    case d.not_multiple_of:
      t = `Number must be a multiple of ${n.multipleOf}`;
      break;
    case d.not_finite:
      t = "Number must be finite";
      break;
    default:
      t = e.defaultError, _.assertNever(n);
  }
  return { message: t };
};
let Xe = pe;
function Ke() {
  return Xe;
}
const et = (n) => {
  const { data: e, path: t, errorMaps: s, issueData: r } = n, a = [...t, ...r.path || []], i = {
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
  const f = s.filter((m) => !!m).slice().reverse();
  for (const m of f)
    o = m(i, { data: e, defaultError: o }).message;
  return {
    ...r,
    path: a,
    message: o
  };
};
function l(n, e) {
  const t = Ke(), s = et({
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
      t === pe ? void 0 : pe
      // then global default map
    ].filter((r) => !!r)
  });
  n.common.issues.push(s);
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
    const s = [];
    for (const r of t) {
      if (r.status === "aborted")
        return p;
      r.status === "dirty" && e.dirty(), s.push(r.value);
    }
    return { status: e.value, value: s };
  }
  static async mergeObjectAsync(e, t) {
    const s = [];
    for (const r of t) {
      const a = await r.key, i = await r.value;
      s.push({
        key: a,
        value: i
      });
    }
    return S.mergeObjectSync(e, s);
  }
  static mergeObjectSync(e, t) {
    const s = {};
    for (const r of t) {
      const { key: a, value: i } = r;
      if (a.status === "aborted" || i.status === "aborted")
        return p;
      a.status === "dirty" && e.dirty(), i.status === "dirty" && e.dirty(), a.value !== "__proto__" && (typeof i.value < "u" || r.alwaysSet) && (s[a.value] = i.value);
    }
    return { status: e.value, value: s };
  }
}
const p = Object.freeze({
  status: "aborted"
}), Q = (n) => ({ status: "dirty", value: n }), I = (n) => ({ status: "valid", value: n }), Ie = (n) => n.status === "aborted", Ae = (n) => n.status === "dirty", H = (n) => n.status === "valid", se = (n) => typeof Promise < "u" && n instanceof Promise;
var h;
(function(n) {
  n.errToObj = (e) => typeof e == "string" ? { message: e } : e || {}, n.toString = (e) => typeof e == "string" ? e : e == null ? void 0 : e.message;
})(h || (h = {}));
class $ {
  constructor(e, t, s, r) {
    this._cachedPath = [], this.parent = e, this.data = t, this._path = s, this._key = r;
  }
  get path() {
    return this._cachedPath.length || (Array.isArray(this._key) ? this._cachedPath.push(...this._path, ...this._key) : this._cachedPath.push(...this._path, this._key)), this._cachedPath;
  }
}
const Oe = (n, e) => {
  if (H(e))
    return { success: !0, data: e.value };
  if (!n.common.issues.length)
    throw new Error("Validation failed but no issues detected.");
  return {
    success: !1,
    get error() {
      if (this._error)
        return this._error;
      const t = new L(n.common.issues);
      return this._error = t, this._error;
    }
  };
};
function y(n) {
  if (!n)
    return {};
  const { errorMap: e, invalid_type_error: t, required_error: s, description: r } = n;
  if (e && (t || s))
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  return e ? { errorMap: e, description: r } : { errorMap: (i, o) => {
    const { message: f } = n;
    return i.code === "invalid_enum_value" ? { message: f ?? o.defaultError } : typeof o.data > "u" ? { message: f ?? s ?? o.defaultError } : i.code !== "invalid_type" ? { message: o.defaultError } : { message: f ?? t ?? o.defaultError };
  }, description: r };
}
class v {
  get description() {
    return this._def.description;
  }
  _getType(e) {
    return D(e.data);
  }
  _getOrReturnCtx(e, t) {
    return t || {
      common: e.parent.common,
      data: e.data,
      parsedType: D(e.data),
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
        parsedType: D(e.data),
        schemaErrorMap: this._def.errorMap,
        path: e.path,
        parent: e.parent
      }
    };
  }
  _parseSync(e) {
    const t = this._parse(e);
    if (se(t))
      throw new Error("Synchronous parse encountered promise.");
    return t;
  }
  _parseAsync(e) {
    const t = this._parse(e);
    return Promise.resolve(t);
  }
  parse(e, t) {
    const s = this.safeParse(e, t);
    if (s.success)
      return s.data;
    throw s.error;
  }
  safeParse(e, t) {
    const s = {
      common: {
        issues: [],
        async: (t == null ? void 0 : t.async) ?? !1,
        contextualErrorMap: t == null ? void 0 : t.errorMap
      },
      path: (t == null ? void 0 : t.path) || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data: e,
      parsedType: D(e)
    }, r = this._parseSync({ data: e, path: s.path, parent: s });
    return Oe(s, r);
  }
  "~validate"(e) {
    var s, r;
    const t = {
      common: {
        issues: [],
        async: !!this["~standard"].async
      },
      path: [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data: e,
      parsedType: D(e)
    };
    if (!this["~standard"].async)
      try {
        const a = this._parseSync({ data: e, path: [], parent: t });
        return H(a) ? {
          value: a.value
        } : {
          issues: t.common.issues
        };
      } catch (a) {
        (r = (s = a == null ? void 0 : a.message) == null ? void 0 : s.toLowerCase()) != null && r.includes("encountered") && (this["~standard"].async = !0), t.common = {
          issues: [],
          async: !0
        };
      }
    return this._parseAsync({ data: e, path: [], parent: t }).then((a) => H(a) ? {
      value: a.value
    } : {
      issues: t.common.issues
    });
  }
  async parseAsync(e, t) {
    const s = await this.safeParseAsync(e, t);
    if (s.success)
      return s.data;
    throw s.error;
  }
  async safeParseAsync(e, t) {
    const s = {
      common: {
        issues: [],
        contextualErrorMap: t == null ? void 0 : t.errorMap,
        async: !0
      },
      path: (t == null ? void 0 : t.path) || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data: e,
      parsedType: D(e)
    }, r = this._parse({ data: e, path: s.path, parent: s }), a = await (se(r) ? r : Promise.resolve(r));
    return Oe(s, a);
  }
  refine(e, t) {
    const s = (r) => typeof t == "string" || typeof t > "u" ? { message: t } : typeof t == "function" ? t(r) : t;
    return this._refinement((r, a) => {
      const i = e(r), o = () => a.addIssue({
        code: d.custom,
        ...s(r)
      });
      return typeof Promise < "u" && i instanceof Promise ? i.then((f) => f ? !0 : (o(), !1)) : i ? !0 : (o(), !1);
    });
  }
  refinement(e, t) {
    return this._refinement((s, r) => e(s) ? !0 : (r.addIssue(typeof t == "function" ? t(s, r) : t), !1));
  }
  _refinement(e) {
    return new W({
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
    return q.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return j.create(this);
  }
  promise() {
    return ce.create(this, this._def);
  }
  or(e) {
    return ae.create([this, e], this._def);
  }
  and(e) {
    return ie.create(this, e, this._def);
  }
  transform(e) {
    return new W({
      ...y(this._def),
      schema: this,
      typeName: g.ZodEffects,
      effect: { type: "transform", transform: e }
    });
  }
  default(e) {
    const t = typeof e == "function" ? e : () => e;
    return new le({
      ...y(this._def),
      innerType: this,
      defaultValue: t,
      typeName: g.ZodDefault
    });
  }
  brand() {
    return new Be({
      typeName: g.ZodBranded,
      type: this,
      ...y(this._def)
    });
  }
  catch(e) {
    const t = typeof e == "function" ? e : () => e;
    return new ue({
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
    return Te.create(this, e);
  }
  readonly() {
    return he.create(this);
  }
  isOptional() {
    return this.safeParse(void 0).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
}
const tt = /^c[^\s-]{8,}$/i, nt = /^[0-9a-z]+$/, st = /^[0-9A-HJKMNP-TV-Z]{26}$/i, rt = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i, at = /^[a-z0-9_-]{21}$/i, it = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/, ot = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/, dt = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i, ct = "^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$";
let fe;
const lt = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/, ut = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/, ht = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/, ft = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/, mt = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/, pt = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/, De = "((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))", gt = new RegExp(`^${De}$`);
function ze(n) {
  let e = "[0-5]\\d";
  n.precision ? e = `${e}\\.\\d{${n.precision}}` : n.precision == null && (e = `${e}(\\.\\d+)?`);
  const t = n.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${e})${t}`;
}
function yt(n) {
  return new RegExp(`^${ze(n)}$`);
}
function vt(n) {
  let e = `${De}T${ze(n)}`;
  const t = [];
  return t.push(n.local ? "Z?" : "Z"), n.offset && t.push("([+-]\\d{2}:?\\d{2})"), e = `${e}(${t.join("|")})`, new RegExp(`^${e}$`);
}
function _t(n, e) {
  return !!((e === "v4" || !e) && lt.test(n) || (e === "v6" || !e) && ht.test(n));
}
function xt(n, e) {
  if (!it.test(n))
    return !1;
  try {
    const [t] = n.split(".");
    if (!t)
      return !1;
    const s = t.replace(/-/g, "+").replace(/_/g, "/").padEnd(t.length + (4 - t.length % 4) % 4, "="), r = JSON.parse(atob(s));
    return !(typeof r != "object" || r === null || "typ" in r && (r == null ? void 0 : r.typ) !== "JWT" || !r.alg || e && r.alg !== e);
  } catch {
    return !1;
  }
}
function kt(n, e) {
  return !!((e === "v4" || !e) && ut.test(n) || (e === "v6" || !e) && ft.test(n));
}
class M extends v {
  _parse(e) {
    if (this._def.coerce && (e.data = String(e.data)), this._getType(e) !== u.string) {
      const a = this._getOrReturnCtx(e);
      return l(a, {
        code: d.invalid_type,
        expected: u.string,
        received: a.parsedType
      }), p;
    }
    const s = new S();
    let r;
    for (const a of this._def.checks)
      if (a.kind === "min")
        e.data.length < a.value && (r = this._getOrReturnCtx(e, r), l(r, {
          code: d.too_small,
          minimum: a.value,
          type: "string",
          inclusive: !0,
          exact: !1,
          message: a.message
        }), s.dirty());
      else if (a.kind === "max")
        e.data.length > a.value && (r = this._getOrReturnCtx(e, r), l(r, {
          code: d.too_big,
          maximum: a.value,
          type: "string",
          inclusive: !0,
          exact: !1,
          message: a.message
        }), s.dirty());
      else if (a.kind === "length") {
        const i = e.data.length > a.value, o = e.data.length < a.value;
        (i || o) && (r = this._getOrReturnCtx(e, r), i ? l(r, {
          code: d.too_big,
          maximum: a.value,
          type: "string",
          inclusive: !0,
          exact: !0,
          message: a.message
        }) : o && l(r, {
          code: d.too_small,
          minimum: a.value,
          type: "string",
          inclusive: !0,
          exact: !0,
          message: a.message
        }), s.dirty());
      } else if (a.kind === "email")
        dt.test(e.data) || (r = this._getOrReturnCtx(e, r), l(r, {
          validation: "email",
          code: d.invalid_string,
          message: a.message
        }), s.dirty());
      else if (a.kind === "emoji")
        fe || (fe = new RegExp(ct, "u")), fe.test(e.data) || (r = this._getOrReturnCtx(e, r), l(r, {
          validation: "emoji",
          code: d.invalid_string,
          message: a.message
        }), s.dirty());
      else if (a.kind === "uuid")
        rt.test(e.data) || (r = this._getOrReturnCtx(e, r), l(r, {
          validation: "uuid",
          code: d.invalid_string,
          message: a.message
        }), s.dirty());
      else if (a.kind === "nanoid")
        at.test(e.data) || (r = this._getOrReturnCtx(e, r), l(r, {
          validation: "nanoid",
          code: d.invalid_string,
          message: a.message
        }), s.dirty());
      else if (a.kind === "cuid")
        tt.test(e.data) || (r = this._getOrReturnCtx(e, r), l(r, {
          validation: "cuid",
          code: d.invalid_string,
          message: a.message
        }), s.dirty());
      else if (a.kind === "cuid2")
        nt.test(e.data) || (r = this._getOrReturnCtx(e, r), l(r, {
          validation: "cuid2",
          code: d.invalid_string,
          message: a.message
        }), s.dirty());
      else if (a.kind === "ulid")
        st.test(e.data) || (r = this._getOrReturnCtx(e, r), l(r, {
          validation: "ulid",
          code: d.invalid_string,
          message: a.message
        }), s.dirty());
      else if (a.kind === "url")
        try {
          new URL(e.data);
        } catch {
          r = this._getOrReturnCtx(e, r), l(r, {
            validation: "url",
            code: d.invalid_string,
            message: a.message
          }), s.dirty();
        }
      else a.kind === "regex" ? (a.regex.lastIndex = 0, a.regex.test(e.data) || (r = this._getOrReturnCtx(e, r), l(r, {
        validation: "regex",
        code: d.invalid_string,
        message: a.message
      }), s.dirty())) : a.kind === "trim" ? e.data = e.data.trim() : a.kind === "includes" ? e.data.includes(a.value, a.position) || (r = this._getOrReturnCtx(e, r), l(r, {
        code: d.invalid_string,
        validation: { includes: a.value, position: a.position },
        message: a.message
      }), s.dirty()) : a.kind === "toLowerCase" ? e.data = e.data.toLowerCase() : a.kind === "toUpperCase" ? e.data = e.data.toUpperCase() : a.kind === "startsWith" ? e.data.startsWith(a.value) || (r = this._getOrReturnCtx(e, r), l(r, {
        code: d.invalid_string,
        validation: { startsWith: a.value },
        message: a.message
      }), s.dirty()) : a.kind === "endsWith" ? e.data.endsWith(a.value) || (r = this._getOrReturnCtx(e, r), l(r, {
        code: d.invalid_string,
        validation: { endsWith: a.value },
        message: a.message
      }), s.dirty()) : a.kind === "datetime" ? vt(a).test(e.data) || (r = this._getOrReturnCtx(e, r), l(r, {
        code: d.invalid_string,
        validation: "datetime",
        message: a.message
      }), s.dirty()) : a.kind === "date" ? gt.test(e.data) || (r = this._getOrReturnCtx(e, r), l(r, {
        code: d.invalid_string,
        validation: "date",
        message: a.message
      }), s.dirty()) : a.kind === "time" ? yt(a).test(e.data) || (r = this._getOrReturnCtx(e, r), l(r, {
        code: d.invalid_string,
        validation: "time",
        message: a.message
      }), s.dirty()) : a.kind === "duration" ? ot.test(e.data) || (r = this._getOrReturnCtx(e, r), l(r, {
        validation: "duration",
        code: d.invalid_string,
        message: a.message
      }), s.dirty()) : a.kind === "ip" ? _t(e.data, a.version) || (r = this._getOrReturnCtx(e, r), l(r, {
        validation: "ip",
        code: d.invalid_string,
        message: a.message
      }), s.dirty()) : a.kind === "jwt" ? xt(e.data, a.alg) || (r = this._getOrReturnCtx(e, r), l(r, {
        validation: "jwt",
        code: d.invalid_string,
        message: a.message
      }), s.dirty()) : a.kind === "cidr" ? kt(e.data, a.version) || (r = this._getOrReturnCtx(e, r), l(r, {
        validation: "cidr",
        code: d.invalid_string,
        message: a.message
      }), s.dirty()) : a.kind === "base64" ? mt.test(e.data) || (r = this._getOrReturnCtx(e, r), l(r, {
        validation: "base64",
        code: d.invalid_string,
        message: a.message
      }), s.dirty()) : a.kind === "base64url" ? pt.test(e.data) || (r = this._getOrReturnCtx(e, r), l(r, {
        validation: "base64url",
        code: d.invalid_string,
        message: a.message
      }), s.dirty()) : _.assertNever(a);
    return { status: s.value, value: e.data };
  }
  _regex(e, t, s) {
    return this.refinement((r) => e.test(r), {
      validation: t,
      code: d.invalid_string,
      ...h.errToObj(s)
    });
  }
  _addCheck(e) {
    return new M({
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
    return new M({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }]
    });
  }
  toLowerCase() {
    return new M({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }]
    });
  }
  toUpperCase() {
    return new M({
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
M.create = (n) => new M({
  checks: [],
  typeName: g.ZodString,
  coerce: (n == null ? void 0 : n.coerce) ?? !1,
  ...y(n)
});
function bt(n, e) {
  const t = (n.toString().split(".")[1] || "").length, s = (e.toString().split(".")[1] || "").length, r = t > s ? t : s, a = Number.parseInt(n.toFixed(r).replace(".", "")), i = Number.parseInt(e.toFixed(r).replace(".", ""));
  return a % i / 10 ** r;
}
class Y extends v {
  constructor() {
    super(...arguments), this.min = this.gte, this.max = this.lte, this.step = this.multipleOf;
  }
  _parse(e) {
    if (this._def.coerce && (e.data = Number(e.data)), this._getType(e) !== u.number) {
      const a = this._getOrReturnCtx(e);
      return l(a, {
        code: d.invalid_type,
        expected: u.number,
        received: a.parsedType
      }), p;
    }
    let s;
    const r = new S();
    for (const a of this._def.checks)
      a.kind === "int" ? _.isInteger(e.data) || (s = this._getOrReturnCtx(e, s), l(s, {
        code: d.invalid_type,
        expected: "integer",
        received: "float",
        message: a.message
      }), r.dirty()) : a.kind === "min" ? (a.inclusive ? e.data < a.value : e.data <= a.value) && (s = this._getOrReturnCtx(e, s), l(s, {
        code: d.too_small,
        minimum: a.value,
        type: "number",
        inclusive: a.inclusive,
        exact: !1,
        message: a.message
      }), r.dirty()) : a.kind === "max" ? (a.inclusive ? e.data > a.value : e.data >= a.value) && (s = this._getOrReturnCtx(e, s), l(s, {
        code: d.too_big,
        maximum: a.value,
        type: "number",
        inclusive: a.inclusive,
        exact: !1,
        message: a.message
      }), r.dirty()) : a.kind === "multipleOf" ? bt(e.data, a.value) !== 0 && (s = this._getOrReturnCtx(e, s), l(s, {
        code: d.not_multiple_of,
        multipleOf: a.value,
        message: a.message
      }), r.dirty()) : a.kind === "finite" ? Number.isFinite(e.data) || (s = this._getOrReturnCtx(e, s), l(s, {
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
  setLimit(e, t, s, r) {
    return new Y({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind: e,
          value: t,
          inclusive: s,
          message: h.toString(r)
        }
      ]
    });
  }
  _addCheck(e) {
    return new Y({
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
    for (const s of this._def.checks) {
      if (s.kind === "finite" || s.kind === "int" || s.kind === "multipleOf")
        return !0;
      s.kind === "min" ? (t === null || s.value > t) && (t = s.value) : s.kind === "max" && (e === null || s.value < e) && (e = s.value);
    }
    return Number.isFinite(t) && Number.isFinite(e);
  }
}
Y.create = (n) => new Y({
  checks: [],
  typeName: g.ZodNumber,
  coerce: (n == null ? void 0 : n.coerce) || !1,
  ...y(n)
});
class K extends v {
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
    if (this._getType(e) !== u.bigint)
      return this._getInvalidInput(e);
    let s;
    const r = new S();
    for (const a of this._def.checks)
      a.kind === "min" ? (a.inclusive ? e.data < a.value : e.data <= a.value) && (s = this._getOrReturnCtx(e, s), l(s, {
        code: d.too_small,
        type: "bigint",
        minimum: a.value,
        inclusive: a.inclusive,
        message: a.message
      }), r.dirty()) : a.kind === "max" ? (a.inclusive ? e.data > a.value : e.data >= a.value) && (s = this._getOrReturnCtx(e, s), l(s, {
        code: d.too_big,
        type: "bigint",
        maximum: a.value,
        inclusive: a.inclusive,
        message: a.message
      }), r.dirty()) : a.kind === "multipleOf" ? e.data % a.value !== BigInt(0) && (s = this._getOrReturnCtx(e, s), l(s, {
        code: d.not_multiple_of,
        multipleOf: a.value,
        message: a.message
      }), r.dirty()) : _.assertNever(a);
    return { status: r.value, value: e.data };
  }
  _getInvalidInput(e) {
    const t = this._getOrReturnCtx(e);
    return l(t, {
      code: d.invalid_type,
      expected: u.bigint,
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
  setLimit(e, t, s, r) {
    return new K({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind: e,
          value: t,
          inclusive: s,
          message: h.toString(r)
        }
      ]
    });
  }
  _addCheck(e) {
    return new K({
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
K.create = (n) => new K({
  checks: [],
  typeName: g.ZodBigInt,
  coerce: (n == null ? void 0 : n.coerce) ?? !1,
  ...y(n)
});
class ge extends v {
  _parse(e) {
    if (this._def.coerce && (e.data = !!e.data), this._getType(e) !== u.boolean) {
      const s = this._getOrReturnCtx(e);
      return l(s, {
        code: d.invalid_type,
        expected: u.boolean,
        received: s.parsedType
      }), p;
    }
    return I(e.data);
  }
}
ge.create = (n) => new ge({
  typeName: g.ZodBoolean,
  coerce: (n == null ? void 0 : n.coerce) || !1,
  ...y(n)
});
class re extends v {
  _parse(e) {
    if (this._def.coerce && (e.data = new Date(e.data)), this._getType(e) !== u.date) {
      const a = this._getOrReturnCtx(e);
      return l(a, {
        code: d.invalid_type,
        expected: u.date,
        received: a.parsedType
      }), p;
    }
    if (Number.isNaN(e.data.getTime())) {
      const a = this._getOrReturnCtx(e);
      return l(a, {
        code: d.invalid_date
      }), p;
    }
    const s = new S();
    let r;
    for (const a of this._def.checks)
      a.kind === "min" ? e.data.getTime() < a.value && (r = this._getOrReturnCtx(e, r), l(r, {
        code: d.too_small,
        message: a.message,
        inclusive: !0,
        exact: !1,
        minimum: a.value,
        type: "date"
      }), s.dirty()) : a.kind === "max" ? e.data.getTime() > a.value && (r = this._getOrReturnCtx(e, r), l(r, {
        code: d.too_big,
        message: a.message,
        inclusive: !0,
        exact: !1,
        maximum: a.value,
        type: "date"
      }), s.dirty()) : _.assertNever(a);
    return {
      status: s.value,
      value: new Date(e.data.getTime())
    };
  }
  _addCheck(e) {
    return new re({
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
re.create = (n) => new re({
  checks: [],
  coerce: (n == null ? void 0 : n.coerce) || !1,
  typeName: g.ZodDate,
  ...y(n)
});
class Re extends v {
  _parse(e) {
    if (this._getType(e) !== u.symbol) {
      const s = this._getOrReturnCtx(e);
      return l(s, {
        code: d.invalid_type,
        expected: u.symbol,
        received: s.parsedType
      }), p;
    }
    return I(e.data);
  }
}
Re.create = (n) => new Re({
  typeName: g.ZodSymbol,
  ...y(n)
});
class ye extends v {
  _parse(e) {
    if (this._getType(e) !== u.undefined) {
      const s = this._getOrReturnCtx(e);
      return l(s, {
        code: d.invalid_type,
        expected: u.undefined,
        received: s.parsedType
      }), p;
    }
    return I(e.data);
  }
}
ye.create = (n) => new ye({
  typeName: g.ZodUndefined,
  ...y(n)
});
class ve extends v {
  _parse(e) {
    if (this._getType(e) !== u.null) {
      const s = this._getOrReturnCtx(e);
      return l(s, {
        code: d.invalid_type,
        expected: u.null,
        received: s.parsedType
      }), p;
    }
    return I(e.data);
  }
}
ve.create = (n) => new ve({
  typeName: g.ZodNull,
  ...y(n)
});
class Ne extends v {
  constructor() {
    super(...arguments), this._any = !0;
  }
  _parse(e) {
    return I(e.data);
  }
}
Ne.create = (n) => new Ne({
  typeName: g.ZodAny,
  ...y(n)
});
class _e extends v {
  constructor() {
    super(...arguments), this._unknown = !0;
  }
  _parse(e) {
    return I(e.data);
  }
}
_e.create = (n) => new _e({
  typeName: g.ZodUnknown,
  ...y(n)
});
class U extends v {
  _parse(e) {
    const t = this._getOrReturnCtx(e);
    return l(t, {
      code: d.invalid_type,
      expected: u.never,
      received: t.parsedType
    }), p;
  }
}
U.create = (n) => new U({
  typeName: g.ZodNever,
  ...y(n)
});
class Ze extends v {
  _parse(e) {
    if (this._getType(e) !== u.undefined) {
      const s = this._getOrReturnCtx(e);
      return l(s, {
        code: d.invalid_type,
        expected: u.void,
        received: s.parsedType
      }), p;
    }
    return I(e.data);
  }
}
Ze.create = (n) => new Ze({
  typeName: g.ZodVoid,
  ...y(n)
});
class j extends v {
  _parse(e) {
    const { ctx: t, status: s } = this._processInputParams(e), r = this._def;
    if (t.parsedType !== u.array)
      return l(t, {
        code: d.invalid_type,
        expected: u.array,
        received: t.parsedType
      }), p;
    if (r.exactLength !== null) {
      const i = t.data.length > r.exactLength.value, o = t.data.length < r.exactLength.value;
      (i || o) && (l(t, {
        code: i ? d.too_big : d.too_small,
        minimum: o ? r.exactLength.value : void 0,
        maximum: i ? r.exactLength.value : void 0,
        type: "array",
        inclusive: !0,
        exact: !0,
        message: r.exactLength.message
      }), s.dirty());
    }
    if (r.minLength !== null && t.data.length < r.minLength.value && (l(t, {
      code: d.too_small,
      minimum: r.minLength.value,
      type: "array",
      inclusive: !0,
      exact: !1,
      message: r.minLength.message
    }), s.dirty()), r.maxLength !== null && t.data.length > r.maxLength.value && (l(t, {
      code: d.too_big,
      maximum: r.maxLength.value,
      type: "array",
      inclusive: !0,
      exact: !1,
      message: r.maxLength.message
    }), s.dirty()), t.common.async)
      return Promise.all([...t.data].map((i, o) => r.type._parseAsync(new $(t, i, t.path, o)))).then((i) => S.mergeArray(s, i));
    const a = [...t.data].map((i, o) => r.type._parseSync(new $(t, i, t.path, o)));
    return S.mergeArray(s, a);
  }
  get element() {
    return this._def.type;
  }
  min(e, t) {
    return new j({
      ...this._def,
      minLength: { value: e, message: h.toString(t) }
    });
  }
  max(e, t) {
    return new j({
      ...this._def,
      maxLength: { value: e, message: h.toString(t) }
    });
  }
  length(e, t) {
    return new j({
      ...this._def,
      exactLength: { value: e, message: h.toString(t) }
    });
  }
  nonempty(e) {
    return this.min(1, e);
  }
}
j.create = (n, e) => new j({
  type: n,
  minLength: null,
  maxLength: null,
  exactLength: null,
  typeName: g.ZodArray,
  ...y(e)
});
function J(n) {
  if (n instanceof w) {
    const e = {};
    for (const t in n.shape) {
      const s = n.shape[t];
      e[t] = P.create(J(s));
    }
    return new w({
      ...n._def,
      shape: () => e
    });
  } else return n instanceof j ? new j({
    ...n._def,
    type: J(n.element)
  }) : n instanceof P ? P.create(J(n.unwrap())) : n instanceof q ? q.create(J(n.unwrap())) : n instanceof B ? B.create(n.items.map((e) => J(e))) : n;
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
    if (this._getType(e) !== u.object) {
      const m = this._getOrReturnCtx(e);
      return l(m, {
        code: d.invalid_type,
        expected: u.object,
        received: m.parsedType
      }), p;
    }
    const { status: s, ctx: r } = this._processInputParams(e), { shape: a, keys: i } = this._getCached(), o = [];
    if (!(this._def.catchall instanceof U && this._def.unknownKeys === "strip"))
      for (const m in r.data)
        i.includes(m) || o.push(m);
    const f = [];
    for (const m of i) {
      const x = a[m], G = r.data[m];
      f.push({
        key: { status: "valid", value: m },
        value: x._parse(new $(r, G, r.path, m)),
        alwaysSet: m in r.data
      });
    }
    if (this._def.catchall instanceof U) {
      const m = this._def.unknownKeys;
      if (m === "passthrough")
        for (const x of o)
          f.push({
            key: { status: "valid", value: x },
            value: { status: "valid", value: r.data[x] }
          });
      else if (m === "strict")
        o.length > 0 && (l(r, {
          code: d.unrecognized_keys,
          keys: o
        }), s.dirty());
      else if (m !== "strip") throw new Error("Internal ZodObject error: invalid unknownKeys value.");
    } else {
      const m = this._def.catchall;
      for (const x of o) {
        const G = r.data[x];
        f.push({
          key: { status: "valid", value: x },
          value: m._parse(
            new $(r, G, r.path, x)
            //, ctx.child(key), value, getParsedType(value)
          ),
          alwaysSet: x in r.data
        });
      }
    }
    return r.common.async ? Promise.resolve().then(async () => {
      const m = [];
      for (const x of f) {
        const G = await x.key, qe = await x.value;
        m.push({
          key: G,
          value: qe,
          alwaysSet: x.alwaysSet
        });
      }
      return m;
    }).then((m) => S.mergeObjectSync(s, m)) : S.mergeObjectSync(s, f);
  }
  get shape() {
    return this._def.shape();
  }
  strict(e) {
    return h.errToObj, new w({
      ...this._def,
      unknownKeys: "strict",
      ...e !== void 0 ? {
        errorMap: (t, s) => {
          var a, i;
          const r = ((i = (a = this._def).errorMap) == null ? void 0 : i.call(a, t, s).message) ?? s.defaultError;
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
    for (const s of _.objectKeys(e))
      e[s] && this.shape[s] && (t[s] = this.shape[s]);
    return new w({
      ...this._def,
      shape: () => t
    });
  }
  omit(e) {
    const t = {};
    for (const s of _.objectKeys(this.shape))
      e[s] || (t[s] = this.shape[s]);
    return new w({
      ...this._def,
      shape: () => t
    });
  }
  /**
   * @deprecated
   */
  deepPartial() {
    return J(this);
  }
  partial(e) {
    const t = {};
    for (const s of _.objectKeys(this.shape)) {
      const r = this.shape[s];
      e && !e[s] ? t[s] = r : t[s] = r.optional();
    }
    return new w({
      ...this._def,
      shape: () => t
    });
  }
  required(e) {
    const t = {};
    for (const s of _.objectKeys(this.shape))
      if (e && !e[s])
        t[s] = this.shape[s];
      else {
        let a = this.shape[s];
        for (; a instanceof P; )
          a = a._def.innerType;
        t[s] = a;
      }
    return new w({
      ...this._def,
      shape: () => t
    });
  }
  keyof() {
    return Ue(_.objectKeys(this.shape));
  }
}
w.create = (n, e) => new w({
  shape: () => n,
  unknownKeys: "strip",
  catchall: U.create(),
  typeName: g.ZodObject,
  ...y(e)
});
w.strictCreate = (n, e) => new w({
  shape: () => n,
  unknownKeys: "strict",
  catchall: U.create(),
  typeName: g.ZodObject,
  ...y(e)
});
w.lazycreate = (n, e) => new w({
  shape: n,
  unknownKeys: "strip",
  catchall: U.create(),
  typeName: g.ZodObject,
  ...y(e)
});
class ae extends v {
  _parse(e) {
    const { ctx: t } = this._processInputParams(e), s = this._def.options;
    function r(a) {
      for (const o of a)
        if (o.result.status === "valid")
          return o.result;
      for (const o of a)
        if (o.result.status === "dirty")
          return t.common.issues.push(...o.ctx.common.issues), o.result;
      const i = a.map((o) => new L(o.ctx.common.issues));
      return l(t, {
        code: d.invalid_union,
        unionErrors: i
      }), p;
    }
    if (t.common.async)
      return Promise.all(s.map(async (a) => {
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
      for (const f of s) {
        const m = {
          ...t,
          common: {
            ...t.common,
            issues: []
          },
          parent: null
        }, x = f._parseSync({
          data: t.data,
          path: t.path,
          parent: m
        });
        if (x.status === "valid")
          return x;
        x.status === "dirty" && !a && (a = { result: x, ctx: m }), m.common.issues.length && i.push(m.common.issues);
      }
      if (a)
        return t.common.issues.push(...a.ctx.common.issues), a.result;
      const o = i.map((f) => new L(f));
      return l(t, {
        code: d.invalid_union,
        unionErrors: o
      }), p;
    }
  }
  get options() {
    return this._def.options;
  }
}
ae.create = (n, e) => new ae({
  options: n,
  typeName: g.ZodUnion,
  ...y(e)
});
const V = (n) => n instanceof ke ? V(n.schema) : n instanceof W ? V(n.innerType()) : n instanceof de ? [n.value] : n instanceof F ? n.options : n instanceof be ? _.objectValues(n.enum) : n instanceof le ? V(n._def.innerType) : n instanceof ye ? [void 0] : n instanceof ve ? [null] : n instanceof P ? [void 0, ...V(n.unwrap())] : n instanceof q ? [null, ...V(n.unwrap())] : n instanceof Be || n instanceof he ? V(n.unwrap()) : n instanceof ue ? V(n._def.innerType) : [];
class Se extends v {
  _parse(e) {
    const { ctx: t } = this._processInputParams(e);
    if (t.parsedType !== u.object)
      return l(t, {
        code: d.invalid_type,
        expected: u.object,
        received: t.parsedType
      }), p;
    const s = this.discriminator, r = t.data[s], a = this.optionsMap.get(r);
    return a ? t.common.async ? a._parseAsync({
      data: t.data,
      path: t.path,
      parent: t
    }) : a._parseSync({
      data: t.data,
      path: t.path,
      parent: t
    }) : (l(t, {
      code: d.invalid_union_discriminator,
      options: Array.from(this.optionsMap.keys()),
      path: [s]
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
  static create(e, t, s) {
    const r = /* @__PURE__ */ new Map();
    for (const a of t) {
      const i = V(a.shape[e]);
      if (!i.length)
        throw new Error(`A discriminator value for key \`${e}\` could not be extracted from all schema options`);
      for (const o of i) {
        if (r.has(o))
          throw new Error(`Discriminator property ${String(e)} has duplicate value ${String(o)}`);
        r.set(o, a);
      }
    }
    return new Se({
      typeName: g.ZodDiscriminatedUnion,
      discriminator: e,
      options: t,
      optionsMap: r,
      ...y(s)
    });
  }
}
function xe(n, e) {
  const t = D(n), s = D(e);
  if (n === e)
    return { valid: !0, data: n };
  if (t === u.object && s === u.object) {
    const r = _.objectKeys(e), a = _.objectKeys(n).filter((o) => r.indexOf(o) !== -1), i = { ...n, ...e };
    for (const o of a) {
      const f = xe(n[o], e[o]);
      if (!f.valid)
        return { valid: !1 };
      i[o] = f.data;
    }
    return { valid: !0, data: i };
  } else if (t === u.array && s === u.array) {
    if (n.length !== e.length)
      return { valid: !1 };
    const r = [];
    for (let a = 0; a < n.length; a++) {
      const i = n[a], o = e[a], f = xe(i, o);
      if (!f.valid)
        return { valid: !1 };
      r.push(f.data);
    }
    return { valid: !0, data: r };
  } else return t === u.date && s === u.date && +n == +e ? { valid: !0, data: n } : { valid: !1 };
}
class ie extends v {
  _parse(e) {
    const { status: t, ctx: s } = this._processInputParams(e), r = (a, i) => {
      if (Ie(a) || Ie(i))
        return p;
      const o = xe(a.value, i.value);
      return o.valid ? ((Ae(a) || Ae(i)) && t.dirty(), { status: t.value, value: o.data }) : (l(s, {
        code: d.invalid_intersection_types
      }), p);
    };
    return s.common.async ? Promise.all([
      this._def.left._parseAsync({
        data: s.data,
        path: s.path,
        parent: s
      }),
      this._def.right._parseAsync({
        data: s.data,
        path: s.path,
        parent: s
      })
    ]).then(([a, i]) => r(a, i)) : r(this._def.left._parseSync({
      data: s.data,
      path: s.path,
      parent: s
    }), this._def.right._parseSync({
      data: s.data,
      path: s.path,
      parent: s
    }));
  }
}
ie.create = (n, e, t) => new ie({
  left: n,
  right: e,
  typeName: g.ZodIntersection,
  ...y(t)
});
class B extends v {
  _parse(e) {
    const { status: t, ctx: s } = this._processInputParams(e);
    if (s.parsedType !== u.array)
      return l(s, {
        code: d.invalid_type,
        expected: u.array,
        received: s.parsedType
      }), p;
    if (s.data.length < this._def.items.length)
      return l(s, {
        code: d.too_small,
        minimum: this._def.items.length,
        inclusive: !0,
        exact: !1,
        type: "array"
      }), p;
    !this._def.rest && s.data.length > this._def.items.length && (l(s, {
      code: d.too_big,
      maximum: this._def.items.length,
      inclusive: !0,
      exact: !1,
      type: "array"
    }), t.dirty());
    const a = [...s.data].map((i, o) => {
      const f = this._def.items[o] || this._def.rest;
      return f ? f._parse(new $(s, i, s.path, o)) : null;
    }).filter((i) => !!i);
    return s.common.async ? Promise.all(a).then((i) => S.mergeArray(t, i)) : S.mergeArray(t, a);
  }
  get items() {
    return this._def.items;
  }
  rest(e) {
    return new B({
      ...this._def,
      rest: e
    });
  }
}
B.create = (n, e) => {
  if (!Array.isArray(n))
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  return new B({
    items: n,
    typeName: g.ZodTuple,
    rest: null,
    ...y(e)
  });
};
class oe extends v {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(e) {
    const { status: t, ctx: s } = this._processInputParams(e);
    if (s.parsedType !== u.object)
      return l(s, {
        code: d.invalid_type,
        expected: u.object,
        received: s.parsedType
      }), p;
    const r = [], a = this._def.keyType, i = this._def.valueType;
    for (const o in s.data)
      r.push({
        key: a._parse(new $(s, o, s.path, o)),
        value: i._parse(new $(s, s.data[o], s.path, o)),
        alwaysSet: o in s.data
      });
    return s.common.async ? S.mergeObjectAsync(t, r) : S.mergeObjectSync(t, r);
  }
  get element() {
    return this._def.valueType;
  }
  static create(e, t, s) {
    return t instanceof v ? new oe({
      keyType: e,
      valueType: t,
      typeName: g.ZodRecord,
      ...y(s)
    }) : new oe({
      keyType: M.create(),
      valueType: e,
      typeName: g.ZodRecord,
      ...y(t)
    });
  }
}
class Ee extends v {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(e) {
    const { status: t, ctx: s } = this._processInputParams(e);
    if (s.parsedType !== u.map)
      return l(s, {
        code: d.invalid_type,
        expected: u.map,
        received: s.parsedType
      }), p;
    const r = this._def.keyType, a = this._def.valueType, i = [...s.data.entries()].map(([o, f], m) => ({
      key: r._parse(new $(s, o, s.path, [m, "key"])),
      value: a._parse(new $(s, f, s.path, [m, "value"]))
    }));
    if (s.common.async) {
      const o = /* @__PURE__ */ new Map();
      return Promise.resolve().then(async () => {
        for (const f of i) {
          const m = await f.key, x = await f.value;
          if (m.status === "aborted" || x.status === "aborted")
            return p;
          (m.status === "dirty" || x.status === "dirty") && t.dirty(), o.set(m.value, x.value);
        }
        return { status: t.value, value: o };
      });
    } else {
      const o = /* @__PURE__ */ new Map();
      for (const f of i) {
        const m = f.key, x = f.value;
        if (m.status === "aborted" || x.status === "aborted")
          return p;
        (m.status === "dirty" || x.status === "dirty") && t.dirty(), o.set(m.value, x.value);
      }
      return { status: t.value, value: o };
    }
  }
}
Ee.create = (n, e, t) => new Ee({
  valueType: e,
  keyType: n,
  typeName: g.ZodMap,
  ...y(t)
});
class ee extends v {
  _parse(e) {
    const { status: t, ctx: s } = this._processInputParams(e);
    if (s.parsedType !== u.set)
      return l(s, {
        code: d.invalid_type,
        expected: u.set,
        received: s.parsedType
      }), p;
    const r = this._def;
    r.minSize !== null && s.data.size < r.minSize.value && (l(s, {
      code: d.too_small,
      minimum: r.minSize.value,
      type: "set",
      inclusive: !0,
      exact: !1,
      message: r.minSize.message
    }), t.dirty()), r.maxSize !== null && s.data.size > r.maxSize.value && (l(s, {
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
      for (const x of f) {
        if (x.status === "aborted")
          return p;
        x.status === "dirty" && t.dirty(), m.add(x.value);
      }
      return { status: t.value, value: m };
    }
    const o = [...s.data.values()].map((f, m) => a._parse(new $(s, f, s.path, m)));
    return s.common.async ? Promise.all(o).then((f) => i(f)) : i(o);
  }
  min(e, t) {
    return new ee({
      ...this._def,
      minSize: { value: e, message: h.toString(t) }
    });
  }
  max(e, t) {
    return new ee({
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
ee.create = (n, e) => new ee({
  valueType: n,
  minSize: null,
  maxSize: null,
  typeName: g.ZodSet,
  ...y(e)
});
class ke extends v {
  get schema() {
    return this._def.getter();
  }
  _parse(e) {
    const { ctx: t } = this._processInputParams(e);
    return this._def.getter()._parse({ data: t.data, path: t.path, parent: t });
  }
}
ke.create = (n, e) => new ke({
  getter: n,
  typeName: g.ZodLazy,
  ...y(e)
});
class de extends v {
  _parse(e) {
    if (e.data !== this._def.value) {
      const t = this._getOrReturnCtx(e);
      return l(t, {
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
de.create = (n, e) => new de({
  value: n,
  typeName: g.ZodLiteral,
  ...y(e)
});
function Ue(n, e) {
  return new F({
    values: n,
    typeName: g.ZodEnum,
    ...y(e)
  });
}
class F extends v {
  _parse(e) {
    if (typeof e.data != "string") {
      const t = this._getOrReturnCtx(e), s = this._def.values;
      return l(t, {
        expected: _.joinValues(s),
        received: t.parsedType,
        code: d.invalid_type
      }), p;
    }
    if (this._cache || (this._cache = new Set(this._def.values)), !this._cache.has(e.data)) {
      const t = this._getOrReturnCtx(e), s = this._def.values;
      return l(t, {
        received: t.data,
        code: d.invalid_enum_value,
        options: s
      }), p;
    }
    return I(e.data);
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
    return F.create(this.options.filter((s) => !e.includes(s)), {
      ...this._def,
      ...t
    });
  }
}
F.create = Ue;
class be extends v {
  _parse(e) {
    const t = _.getValidEnumValues(this._def.values), s = this._getOrReturnCtx(e);
    if (s.parsedType !== u.string && s.parsedType !== u.number) {
      const r = _.objectValues(t);
      return l(s, {
        expected: _.joinValues(r),
        received: s.parsedType,
        code: d.invalid_type
      }), p;
    }
    if (this._cache || (this._cache = new Set(_.getValidEnumValues(this._def.values))), !this._cache.has(e.data)) {
      const r = _.objectValues(t);
      return l(s, {
        received: s.data,
        code: d.invalid_enum_value,
        options: r
      }), p;
    }
    return I(e.data);
  }
  get enum() {
    return this._def.values;
  }
}
be.create = (n, e) => new be({
  values: n,
  typeName: g.ZodNativeEnum,
  ...y(e)
});
class ce extends v {
  unwrap() {
    return this._def.type;
  }
  _parse(e) {
    const { ctx: t } = this._processInputParams(e);
    if (t.parsedType !== u.promise && t.common.async === !1)
      return l(t, {
        code: d.invalid_type,
        expected: u.promise,
        received: t.parsedType
      }), p;
    const s = t.parsedType === u.promise ? t.data : Promise.resolve(t.data);
    return I(s.then((r) => this._def.type.parseAsync(r, {
      path: t.path,
      errorMap: t.common.contextualErrorMap
    })));
  }
}
ce.create = (n, e) => new ce({
  type: n,
  typeName: g.ZodPromise,
  ...y(e)
});
class W extends v {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === g.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(e) {
    const { status: t, ctx: s } = this._processInputParams(e), r = this._def.effect || null, a = {
      addIssue: (i) => {
        l(s, i), i.fatal ? t.abort() : t.dirty();
      },
      get path() {
        return s.path;
      }
    };
    if (a.addIssue = a.addIssue.bind(a), r.type === "preprocess") {
      const i = r.transform(s.data, a);
      if (s.common.async)
        return Promise.resolve(i).then(async (o) => {
          if (t.value === "aborted")
            return p;
          const f = await this._def.schema._parseAsync({
            data: o,
            path: s.path,
            parent: s
          });
          return f.status === "aborted" ? p : f.status === "dirty" || t.value === "dirty" ? Q(f.value) : f;
        });
      {
        if (t.value === "aborted")
          return p;
        const o = this._def.schema._parseSync({
          data: i,
          path: s.path,
          parent: s
        });
        return o.status === "aborted" ? p : o.status === "dirty" || t.value === "dirty" ? Q(o.value) : o;
      }
    }
    if (r.type === "refinement") {
      const i = (o) => {
        const f = r.refinement(o, a);
        if (s.common.async)
          return Promise.resolve(f);
        if (f instanceof Promise)
          throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        return o;
      };
      if (s.common.async === !1) {
        const o = this._def.schema._parseSync({
          data: s.data,
          path: s.path,
          parent: s
        });
        return o.status === "aborted" ? p : (o.status === "dirty" && t.dirty(), i(o.value), { status: t.value, value: o.value });
      } else
        return this._def.schema._parseAsync({ data: s.data, path: s.path, parent: s }).then((o) => o.status === "aborted" ? p : (o.status === "dirty" && t.dirty(), i(o.value).then(() => ({ status: t.value, value: o.value }))));
    }
    if (r.type === "transform")
      if (s.common.async === !1) {
        const i = this._def.schema._parseSync({
          data: s.data,
          path: s.path,
          parent: s
        });
        if (!H(i))
          return p;
        const o = r.transform(i.value, a);
        if (o instanceof Promise)
          throw new Error("Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.");
        return { status: t.value, value: o };
      } else
        return this._def.schema._parseAsync({ data: s.data, path: s.path, parent: s }).then((i) => H(i) ? Promise.resolve(r.transform(i.value, a)).then((o) => ({
          status: t.value,
          value: o
        })) : p);
    _.assertNever(r);
  }
}
W.create = (n, e, t) => new W({
  schema: n,
  typeName: g.ZodEffects,
  effect: e,
  ...y(t)
});
W.createWithPreprocess = (n, e, t) => new W({
  schema: e,
  effect: { type: "preprocess", transform: n },
  typeName: g.ZodEffects,
  ...y(t)
});
class P extends v {
  _parse(e) {
    return this._getType(e) === u.undefined ? I(void 0) : this._def.innerType._parse(e);
  }
  unwrap() {
    return this._def.innerType;
  }
}
P.create = (n, e) => new P({
  innerType: n,
  typeName: g.ZodOptional,
  ...y(e)
});
class q extends v {
  _parse(e) {
    return this._getType(e) === u.null ? I(null) : this._def.innerType._parse(e);
  }
  unwrap() {
    return this._def.innerType;
  }
}
q.create = (n, e) => new q({
  innerType: n,
  typeName: g.ZodNullable,
  ...y(e)
});
class le extends v {
  _parse(e) {
    const { ctx: t } = this._processInputParams(e);
    let s = t.data;
    return t.parsedType === u.undefined && (s = this._def.defaultValue()), this._def.innerType._parse({
      data: s,
      path: t.path,
      parent: t
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
}
le.create = (n, e) => new le({
  innerType: n,
  typeName: g.ZodDefault,
  defaultValue: typeof e.default == "function" ? e.default : () => e.default,
  ...y(e)
});
class ue extends v {
  _parse(e) {
    const { ctx: t } = this._processInputParams(e), s = {
      ...t,
      common: {
        ...t.common,
        issues: []
      }
    }, r = this._def.innerType._parse({
      data: s.data,
      path: s.path,
      parent: {
        ...s
      }
    });
    return se(r) ? r.then((a) => ({
      status: "valid",
      value: a.status === "valid" ? a.value : this._def.catchValue({
        get error() {
          return new L(s.common.issues);
        },
        input: s.data
      })
    })) : {
      status: "valid",
      value: r.status === "valid" ? r.value : this._def.catchValue({
        get error() {
          return new L(s.common.issues);
        },
        input: s.data
      })
    };
  }
  removeCatch() {
    return this._def.innerType;
  }
}
ue.create = (n, e) => new ue({
  innerType: n,
  typeName: g.ZodCatch,
  catchValue: typeof e.catch == "function" ? e.catch : () => e.catch,
  ...y(e)
});
class je extends v {
  _parse(e) {
    if (this._getType(e) !== u.nan) {
      const s = this._getOrReturnCtx(e);
      return l(s, {
        code: d.invalid_type,
        expected: u.nan,
        received: s.parsedType
      }), p;
    }
    return { status: "valid", value: e.data };
  }
}
je.create = (n) => new je({
  typeName: g.ZodNaN,
  ...y(n)
});
class Be extends v {
  _parse(e) {
    const { ctx: t } = this._processInputParams(e), s = t.data;
    return this._def.type._parse({
      data: s,
      path: t.path,
      parent: t
    });
  }
  unwrap() {
    return this._def.type;
  }
}
class Te extends v {
  _parse(e) {
    const { status: t, ctx: s } = this._processInputParams(e);
    if (s.common.async)
      return (async () => {
        const a = await this._def.in._parseAsync({
          data: s.data,
          path: s.path,
          parent: s
        });
        return a.status === "aborted" ? p : a.status === "dirty" ? (t.dirty(), Q(a.value)) : this._def.out._parseAsync({
          data: a.value,
          path: s.path,
          parent: s
        });
      })();
    {
      const r = this._def.in._parseSync({
        data: s.data,
        path: s.path,
        parent: s
      });
      return r.status === "aborted" ? p : r.status === "dirty" ? (t.dirty(), {
        status: "dirty",
        value: r.value
      }) : this._def.out._parseSync({
        data: r.value,
        path: s.path,
        parent: s
      });
    }
  }
  static create(e, t) {
    return new Te({
      in: e,
      out: t,
      typeName: g.ZodPipeline
    });
  }
}
class he extends v {
  _parse(e) {
    const t = this._def.innerType._parse(e), s = (r) => (H(r) && (r.value = Object.freeze(r.value)), r);
    return se(t) ? t.then((r) => s(r)) : s(t);
  }
  unwrap() {
    return this._def.innerType;
  }
}
he.create = (n, e) => new he({
  innerType: n,
  typeName: g.ZodReadonly,
  ...y(e)
});
var g;
(function(n) {
  n.ZodString = "ZodString", n.ZodNumber = "ZodNumber", n.ZodNaN = "ZodNaN", n.ZodBigInt = "ZodBigInt", n.ZodBoolean = "ZodBoolean", n.ZodDate = "ZodDate", n.ZodSymbol = "ZodSymbol", n.ZodUndefined = "ZodUndefined", n.ZodNull = "ZodNull", n.ZodAny = "ZodAny", n.ZodUnknown = "ZodUnknown", n.ZodNever = "ZodNever", n.ZodVoid = "ZodVoid", n.ZodArray = "ZodArray", n.ZodObject = "ZodObject", n.ZodUnion = "ZodUnion", n.ZodDiscriminatedUnion = "ZodDiscriminatedUnion", n.ZodIntersection = "ZodIntersection", n.ZodTuple = "ZodTuple", n.ZodRecord = "ZodRecord", n.ZodMap = "ZodMap", n.ZodSet = "ZodSet", n.ZodFunction = "ZodFunction", n.ZodLazy = "ZodLazy", n.ZodLiteral = "ZodLiteral", n.ZodEnum = "ZodEnum", n.ZodEffects = "ZodEffects", n.ZodNativeEnum = "ZodNativeEnum", n.ZodOptional = "ZodOptional", n.ZodNullable = "ZodNullable", n.ZodDefault = "ZodDefault", n.ZodCatch = "ZodCatch", n.ZodPromise = "ZodPromise", n.ZodBranded = "ZodBranded", n.ZodPipeline = "ZodPipeline", n.ZodReadonly = "ZodReadonly";
})(g || (g = {}));
const c = M.create, b = Y.create, $e = ge.create, Fe = _e.create;
U.create;
const wt = j.create, k = w.create;
ae.create;
const We = Se.create;
ie.create;
B.create;
const me = oe.create, T = de.create, R = F.create;
ce.create;
P.create;
q.create;
const St = [
  "ingest",
  "normalize",
  "scene-detect",
  "dedup",
  "asr",
  "vision",
  "graph",
  "reason"
], Z = R(St), Tt = We("type", [
  k({ type: T("run:start"), runId: c(), at: b() }),
  k({ type: T("stage:start"), runId: c(), stage: Z, attempt: b().int().min(1) }),
  k({ type: T("stage:resumed"), runId: c(), stage: Z }),
  // A stage that will never run for THIS source — no frames to dedup, no
  // backend to see them. Distinct from "waiting", which a user reads as
  // "still to come" and which never resolves.
  k({ type: T("stage:skipped"), runId: c(), stage: Z, why: c() }),
  k({
    type: T("stage:progress"),
    runId: c(),
    stage: Z,
    done: b().int().min(0),
    total: b().int().min(0),
    note: c().optional()
  }),
  k({ type: T("stage:done"), runId: c(), stage: Z, ms: b().min(0) }),
  k({
    type: T("stage:degraded"),
    runId: c(),
    stage: Z,
    code: c(),
    message: c()
  }),
  k({ type: T("run:done"), runId: c(), ms: b().min(0) }),
  k({
    type: T("run:failed"),
    runId: c(),
    stage: Z.nullable(),
    code: c(),
    message: c()
  }),
  k({ type: T("run:cancelled"), runId: c(), stage: Z.nullable() })
]), Ct = R(["url", "file"]), It = R(["claimed", "running", "succeeded", "failed", "cancelled"]), At = R(["audio", "visual", "both"]);
k({
  id: c(),
  kind: Ct,
  uri: c(),
  contentSha256: c().length(64).nullable(),
  title: c().nullable(),
  durationS: b().positive().nullable(),
  hasAudio: $e(),
  hasVideo: $e(),
  createdAt: b().int()
});
k({
  id: c(),
  sourceId: c(),
  schemaRevisionId: c().nullable(),
  status: It,
  stagePointer: Z.nullable(),
  errorCode: c().nullable(),
  errorMessage: c().nullable(),
  leaseOwner: c().nullable(),
  leaseExpiresAt: b().int().nullable(),
  createdAt: b().int(),
  startedAt: b().int().nullable(),
  finishedAt: b().int().nullable()
});
k({
  runId: c(),
  stage: Z,
  attempt: b().int().min(1),
  inputHash: c(),
  status: R(["running", "done", "failed", "degraded"]),
  errorCode: c().nullable(),
  errorMessage: c().nullable(),
  startedAt: b().int(),
  finishedAt: b().int().nullable()
});
k({
  id: c(),
  runId: c(),
  kind: c(),
  relPath: c(),
  sha256: c().length(64),
  bytes: b().int().min(0),
  contentType: c(),
  createdAt: b().int()
});
k({
  id: c(),
  runId: c(),
  modality: At,
  sourceRef: c(),
  tStart: b().min(0),
  tEnd: b().min(0),
  quote: c().nullable(),
  nodeKey: c().nullable()
});
k({
  observationId: c(),
  runId: c(),
  fieldPath: c(),
  valueJson: c(),
  propositionKey: c().nullable(),
  retractsObservationId: c().nullable(),
  createdAt: b().int()
});
k({
  observationId: c(),
  evidenceCoverage: R(["none", "single", "multiple"]),
  evidenceModalities: b().int().min(0).max(2),
  evidenceQuality: R(["verbatim", "ocr_uncertain", "inferred"]),
  consistency: R(["agree", "conflict", "retracted"]),
  mappingStatus: R(["matched", "provisional", "unmapped"]),
  /** Queue order only. Higher means "a human should look sooner". Never shown as a percentage. */
  reviewPriority: b().int(),
  priorityVersion: b().int().min(1)
});
k({
  id: c(),
  observationId: c(),
  decision: R(["approved", "rejected", "reopened"]),
  actor: c(),
  note: c().nullable(),
  schemaRevisionId: c().nullable(),
  createdAt: b().int()
});
k({
  runId: c(),
  sourceSha256: c().nullable(),
  schemaRevisionId: c().nullable(),
  schemaJson: c().nullable(),
  prompts: me(c(), c()),
  asrEngine: c().nullable(),
  asrModel: c().nullable(),
  inferenceBackend: c().nullable(),
  inferenceModel: c().nullable(),
  backendVersion: c().nullable(),
  dependencyVersions: me(c(), c()),
  settings: me(c(), Fe()),
  createdAt: b().int()
});
const Ot = k({
  source: c().min(1),
  schemaJson: c().nullable(),
  backendId: c().nullable(),
  /** Which stored revision this run was asked with, when it came from one. */
  schemaRevisionId: c().nullable().optional()
}), Rt = k({ runId: c().min(1) }), Nt = k({ source: c().min(1) }), Zt = k({
  name: c(),
  kind: R(["text", "list", "number", "date"]),
  description: c().optional()
}), Et = k({
  schemaId: c().optional(),
  name: c().min(1),
  description: c().optional(),
  fields: wt(Zt)
}), Ve = k({ schemaId: c().min(1) });
We("kind", [
  k({ kind: T("event"), event: Tt }),
  k({ kind: T("done"), runId: c(), summary: Fe() }),
  k({
    kind: T("failed"),
    runId: c(),
    error: k({ code: c(), message: c() })
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
}, we = te.dirname(He(import.meta.url)), Me = process.env.VITE_DEV_SERVER_URL;
let E = null, z = null;
const X = /* @__PURE__ */ new Map(), jt = () => {
  const n = Qe.fork(te.join(we, "engine-host.js"), [], { stdio: "inherit" });
  return n.on("message", (e) => {
    const t = e;
    if (t.kind === "event") {
      E == null || E.webContents.send(C.engineEvent, t.event);
      return;
    }
    const s = X.get(t.id);
    s !== void 0 && (X.delete(t.id), t.kind === "result" ? s.resolve(t.value) : s.reject(Object.assign(new Error(t.error.message), { code: t.error.code })));
  }), n.on("exit", () => {
    for (const [, e] of X)
      e.reject(new Error("the engine process stopped"));
    X.clear(), z = null;
  }), n;
}, N = (n) => {
  z ?? (z = jt());
  const e = Je();
  return new Promise((t, s) => {
    X.set(e, { resolve: t, reject: s }), z == null || z.postMessage({ id: e, ...n });
  });
}, $t = async (n) => {
  try {
    return { ok: !0, value: await n() };
  } catch (e) {
    return { ok: !1, error: { code: e.code ?? "INTERNAL", message: e instanceof Error ? e.message : String(e) } };
  }
}, Pe = () => {
  E = new Le({
    width: 1180,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#101012",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: te.join(we, "../preload/index.js"),
      contextIsolation: !0,
      nodeIntegration: !1,
      sandbox: !1
    }
  }), E.webContents.setWindowOpenHandler(({ url: n }) => (/^https?:\/\//i.test(n) && Ye.openExternal(n), { action: "deny" })), E.webContents.on("will-navigate", (n) => n.preventDefault()), Me !== void 0 ? E.loadURL(Me) : E.loadFile(te.join(we, "../../dist/index.html")), E.on("closed", () => {
    E = null;
  });
}, Vt = (n) => n.senderFrame !== null && n.senderFrame.parent === null, O = (n) => async (e, t) => Vt(e) ? $t(() => n(t)) : { ok: !1, error: { code: "FORBIDDEN", message: "not the main frame" } };
ne.whenReady().then(() => {
  A.handle(C.doctor, O(() => N({ type: "doctor" }))), A.handle(C.listRuns, O(() => N({ type: "listRuns" }))), A.handle(
    C.runDetail,
    O((n) => N({ type: "runDetail", runId: Rt.parse(n).runId }))
  ), A.handle(
    C.extract,
    O((n) => N({ type: "extract", request: Ot.parse(n) }))
  ), A.handle(
    C.inspect,
    O((n) => N({ type: "inspect", source: Nt.parse(n).source }))
  ), A.handle(C.listSchemas, O(() => N({ type: "listSchemas" }))), A.handle(
    C.saveSchema,
    O((n) => N({ type: "saveSchema", input: Et.parse(n) }))
  ), A.handle(
    C.schemaRevisions,
    O((n) => N({ type: "schemaRevisions", schemaId: Ve.parse(n).schemaId }))
  ), A.handle(
    C.archiveSchema,
    O((n) => N({ type: "archiveSchema", schemaId: Ve.parse(n).schemaId }))
  ), A.handle(C.cancel, O(() => N({ type: "cancel" }))), A.handle(
    C.pickFile,
    O(async () => {
      const n = await Ge.showOpenDialog({
        properties: ["openFile"],
        filters: [{ name: "Video or audio", extensions: ["mp4", "mov", "mkv", "webm", "m4a", "mp3", "wav", "flac"] }]
      });
      return n.canceled ? null : n.filePaths[0] ?? null;
    })
  ), Pe(), ne.on("activate", () => {
    Le.getAllWindows().length === 0 && Pe();
  });
});
ne.on("window-all-closed", () => {
  z == null || z.kill(), process.platform !== "darwin" && ne.quit();
});
