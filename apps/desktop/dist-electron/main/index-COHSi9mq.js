import { randomUUID as Lr } from "node:crypto";
import Me from "node:path";
import { fileURLToPath as Vr } from "node:url";
import { protocol as Er, app as wt, ipcMain as Te, BrowserWindow as Ir, shell as Fr, dialog as hr, utilityProcess as Dr } from "electron";
import { statSync as Ur, createReadStream as Br } from "node:fs";
import { Readable as Wr } from "node:stream";
import "node:child_process";
import { homedir as Yr } from "node:os";
import "node:fs/promises";
import "node:stream/promises";
import "node:sqlite";
var ue;
(function(r) {
  r.assertEqual = (a) => {
  };
  function e(a) {
  }
  r.assertIs = e;
  function t(a) {
    throw new Error();
  }
  r.assertNever = t, r.arrayToEnum = (a) => {
    const s = {};
    for (const i of a)
      s[i] = i;
    return s;
  }, r.getValidEnumValues = (a) => {
    const s = r.objectKeys(a).filter((c) => typeof a[a[c]] != "number"), i = {};
    for (const c of s)
      i[c] = a[c];
    return r.objectValues(i);
  }, r.objectValues = (a) => r.objectKeys(a).map(function(s) {
    return a[s];
  }), r.objectKeys = typeof Object.keys == "function" ? (a) => Object.keys(a) : (a) => {
    const s = [];
    for (const i in a)
      Object.prototype.hasOwnProperty.call(a, i) && s.push(i);
    return s;
  }, r.find = (a, s) => {
    for (const i of a)
      if (s(i))
        return i;
  }, r.isInteger = typeof Number.isInteger == "function" ? (a) => Number.isInteger(a) : (a) => typeof a == "number" && Number.isFinite(a) && Math.floor(a) === a;
  function n(a, s = " | ") {
    return a.map((i) => typeof i == "string" ? `'${i}'` : i).join(s);
  }
  r.joinValues = n, r.jsonStringifyReplacer = (a, s) => typeof s == "bigint" ? s.toString() : s;
})(ue || (ue = {}));
var mr;
(function(r) {
  r.mergeShapes = (e, t) => ({
    ...e,
    ...t
    // second overwrites first
  });
})(mr || (mr = {}));
const x = ue.arrayToEnum([
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
]), Je = (r) => {
  switch (typeof r) {
    case "undefined":
      return x.undefined;
    case "string":
      return x.string;
    case "number":
      return Number.isNaN(r) ? x.nan : x.number;
    case "boolean":
      return x.boolean;
    case "function":
      return x.function;
    case "bigint":
      return x.bigint;
    case "symbol":
      return x.symbol;
    case "object":
      return Array.isArray(r) ? x.array : r === null ? x.null : r.then && typeof r.then == "function" && r.catch && typeof r.catch == "function" ? x.promise : typeof Map < "u" && r instanceof Map ? x.map : typeof Set < "u" && r instanceof Set ? x.set : typeof Date < "u" && r instanceof Date ? x.date : x.object;
    default:
      return x.unknown;
  }
}, l = ue.arrayToEnum([
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
class He extends Error {
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
    }, n = { _errors: [] }, a = (s) => {
      for (const i of s.issues)
        if (i.code === "invalid_union")
          i.unionErrors.map(a);
        else if (i.code === "invalid_return_type")
          a(i.returnTypeError);
        else if (i.code === "invalid_arguments")
          a(i.argumentsError);
        else if (i.path.length === 0)
          n._errors.push(t(i));
        else {
          let c = n, h = 0;
          for (; h < i.path.length; ) {
            const y = i.path[h];
            h === i.path.length - 1 ? (c[y] = c[y] || { _errors: [] }, c[y]._errors.push(t(i))) : c[y] = c[y] || { _errors: [] }, c = c[y], h++;
          }
        }
    };
    return a(this), n;
  }
  static assert(e) {
    if (!(e instanceof He))
      throw new Error(`Not a ZodError: ${e}`);
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, ue.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(e = (t) => t.message) {
    const t = {}, n = [];
    for (const a of this.issues)
      if (a.path.length > 0) {
        const s = a.path[0];
        t[s] = t[s] || [], t[s].push(e(a));
      } else
        n.push(e(a));
    return { formErrors: n, fieldErrors: t };
  }
  get formErrors() {
    return this.flatten();
  }
}
He.create = (r) => new He(r);
const Lt = (r, e) => {
  let t;
  switch (r.code) {
    case l.invalid_type:
      r.received === x.undefined ? t = "Required" : t = `Expected ${r.expected}, received ${r.received}`;
      break;
    case l.invalid_literal:
      t = `Invalid literal value, expected ${JSON.stringify(r.expected, ue.jsonStringifyReplacer)}`;
      break;
    case l.unrecognized_keys:
      t = `Unrecognized key(s) in object: ${ue.joinValues(r.keys, ", ")}`;
      break;
    case l.invalid_union:
      t = "Invalid input";
      break;
    case l.invalid_union_discriminator:
      t = `Invalid discriminator value. Expected ${ue.joinValues(r.options)}`;
      break;
    case l.invalid_enum_value:
      t = `Invalid enum value. Expected ${ue.joinValues(r.options)}, received '${r.received}'`;
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
      typeof r.validation == "object" ? "includes" in r.validation ? (t = `Invalid input: must include "${r.validation.includes}"`, typeof r.validation.position == "number" && (t = `${t} at one or more positions greater than or equal to ${r.validation.position}`)) : "startsWith" in r.validation ? t = `Invalid input: must start with "${r.validation.startsWith}"` : "endsWith" in r.validation ? t = `Invalid input: must end with "${r.validation.endsWith}"` : ue.assertNever(r.validation) : r.validation !== "regex" ? t = `Invalid ${r.validation}` : t = "Invalid";
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
      t = e.defaultError, ue.assertNever(r);
  }
  return { message: t };
};
let qr = Lt;
function Hr() {
  return qr;
}
const Xr = (r) => {
  const { data: e, path: t, errorMaps: n, issueData: a } = r, s = [...t, ...a.path || []], i = {
    ...a,
    path: s
  };
  if (a.message !== void 0)
    return {
      ...a,
      path: s,
      message: a.message
    };
  let c = "";
  const h = n.filter((y) => !!y).slice().reverse();
  for (const y of h)
    c = y(i, { data: e, defaultError: c }).message;
  return {
    ...a,
    path: s,
    message: c
  };
};
function m(r, e) {
  const t = Hr(), n = Xr({
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
      t === Lt ? void 0 : Lt
      // then global default map
    ].filter((a) => !!a)
  });
  r.common.issues.push(n);
}
class Ie {
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
    for (const a of t) {
      if (a.status === "aborted")
        return Z;
      a.status === "dirty" && e.dirty(), n.push(a.value);
    }
    return { status: e.value, value: n };
  }
  static async mergeObjectAsync(e, t) {
    const n = [];
    for (const a of t) {
      const s = await a.key, i = await a.value;
      n.push({
        key: s,
        value: i
      });
    }
    return Ie.mergeObjectSync(e, n);
  }
  static mergeObjectSync(e, t) {
    const n = {};
    for (const a of t) {
      const { key: s, value: i } = a;
      if (s.status === "aborted" || i.status === "aborted")
        return Z;
      s.status === "dirty" && e.dirty(), i.status === "dirty" && e.dirty(), s.value !== "__proto__" && (typeof i.value < "u" || a.alwaysSet) && (n[s.value] = i.value);
    }
    return { status: e.value, value: n };
  }
}
const Z = Object.freeze({
  status: "aborted"
}), mt = (r) => ({ status: "dirty", value: r }), $e = (r) => ({ status: "valid", value: r }), vr = (r) => r.status === "aborted", pr = (r) => r.status === "dirty", ct = (r) => r.status === "valid", Tt = (r) => typeof Promise < "u" && r instanceof Promise;
var k;
(function(r) {
  r.errToObj = (e) => typeof e == "string" ? { message: e } : e || {}, r.toString = (e) => typeof e == "string" ? e : e == null ? void 0 : e.message;
})(k || (k = {}));
class Ue {
  constructor(e, t, n, a) {
    this._cachedPath = [], this.parent = e, this.data = t, this._path = n, this._key = a;
  }
  get path() {
    return this._cachedPath.length || (Array.isArray(this._key) ? this._cachedPath.push(...this._path, ...this._key) : this._cachedPath.push(...this._path, this._key)), this._cachedPath;
  }
}
const xr = (r, e) => {
  if (ct(e))
    return { success: !0, data: e.value };
  if (!r.common.issues.length)
    throw new Error("Validation failed but no issues detected.");
  return {
    success: !1,
    get error() {
      if (this._error)
        return this._error;
      const t = new He(r.common.issues);
      return this._error = t, this._error;
    }
  };
};
function Y(r) {
  if (!r)
    return {};
  const { errorMap: e, invalid_type_error: t, required_error: n, description: a } = r;
  if (e && (t || n))
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  return e ? { errorMap: e, description: a } : { errorMap: (i, c) => {
    const { message: h } = r;
    return i.code === "invalid_enum_value" ? { message: h ?? c.defaultError } : typeof c.data > "u" ? { message: h ?? n ?? c.defaultError } : i.code !== "invalid_type" ? { message: c.defaultError } : { message: h ?? t ?? c.defaultError };
  }, description: a };
}
class K {
  get description() {
    return this._def.description;
  }
  _getType(e) {
    return Je(e.data);
  }
  _getOrReturnCtx(e, t) {
    return t || {
      common: e.parent.common,
      data: e.data,
      parsedType: Je(e.data),
      schemaErrorMap: this._def.errorMap,
      path: e.path,
      parent: e.parent
    };
  }
  _processInputParams(e) {
    return {
      status: new Ie(),
      ctx: {
        common: e.parent.common,
        data: e.data,
        parsedType: Je(e.data),
        schemaErrorMap: this._def.errorMap,
        path: e.path,
        parent: e.parent
      }
    };
  }
  _parseSync(e) {
    const t = this._parse(e);
    if (Tt(t))
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
      parsedType: Je(e)
    }, a = this._parseSync({ data: e, path: n.path, parent: n });
    return xr(n, a);
  }
  "~validate"(e) {
    var n, a;
    const t = {
      common: {
        issues: [],
        async: !!this["~standard"].async
      },
      path: [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data: e,
      parsedType: Je(e)
    };
    if (!this["~standard"].async)
      try {
        const s = this._parseSync({ data: e, path: [], parent: t });
        return ct(s) ? {
          value: s.value
        } : {
          issues: t.common.issues
        };
      } catch (s) {
        (a = (n = s == null ? void 0 : s.message) == null ? void 0 : n.toLowerCase()) != null && a.includes("encountered") && (this["~standard"].async = !0), t.common = {
          issues: [],
          async: !0
        };
      }
    return this._parseAsync({ data: e, path: [], parent: t }).then((s) => ct(s) ? {
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
      parsedType: Je(e)
    }, a = this._parse({ data: e, path: n.path, parent: n }), s = await (Tt(a) ? a : Promise.resolve(a));
    return xr(n, s);
  }
  refine(e, t) {
    const n = (a) => typeof t == "string" || typeof t > "u" ? { message: t } : typeof t == "function" ? t(a) : t;
    return this._refinement((a, s) => {
      const i = e(a), c = () => s.addIssue({
        code: l.custom,
        ...n(a)
      });
      return typeof Promise < "u" && i instanceof Promise ? i.then((h) => h ? !0 : (c(), !1)) : i ? !0 : (c(), !1);
    });
  }
  refinement(e, t) {
    return this._refinement((n, a) => e(n) ? !0 : (a.addIssue(typeof t == "function" ? t(n, a) : t), !1));
  }
  _refinement(e) {
    return new rt({
      schema: this,
      typeName: M.ZodEffects,
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
    return qe.create(this, this._def);
  }
  nullable() {
    return nt.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return De.create(this);
  }
  promise() {
    return Ft.create(this, this._def);
  }
  or(e) {
    return At.create([this, e], this._def);
  }
  and(e) {
    return St.create(this, e, this._def);
  }
  transform(e) {
    return new rt({
      ...Y(this._def),
      schema: this,
      typeName: M.ZodEffects,
      effect: { type: "transform", transform: e }
    });
  }
  default(e) {
    const t = typeof e == "function" ? e : () => e;
    return new Rt({
      ...Y(this._def),
      innerType: this,
      defaultValue: t,
      typeName: M.ZodDefault
    });
  }
  brand() {
    return new Zr({
      typeName: M.ZodBranded,
      type: this,
      ...Y(this._def)
    });
  }
  catch(e) {
    const t = typeof e == "function" ? e : () => e;
    return new Ot({
      ...Y(this._def),
      innerType: this,
      catchValue: t,
      typeName: M.ZodCatch
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
    return zt.create(this, e);
  }
  readonly() {
    return Nt.create(this);
  }
  isOptional() {
    return this.safeParse(void 0).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
}
const zr = /^c[^\s-]{8,}$/i, Jr = /^[0-9a-z]+$/, Gr = /^[0-9A-HJKMNP-TV-Z]{26}$/i, Qr = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i, Kr = /^[a-z0-9_-]{21}$/i, en = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/, tn = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/, rn = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i, nn = "^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$";
let jt;
const an = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/, sn = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/, on = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/, cn = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/, dn = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/, ln = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/, Rr = "((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))", un = new RegExp(`^${Rr}$`);
function Or(r) {
  let e = "[0-5]\\d";
  r.precision ? e = `${e}\\.\\d{${r.precision}}` : r.precision == null && (e = `${e}(\\.\\d+)?`);
  const t = r.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${e})${t}`;
}
function fn(r) {
  return new RegExp(`^${Or(r)}$`);
}
function hn(r) {
  let e = `${Rr}T${Or(r)}`;
  const t = [];
  return t.push(r.local ? "Z?" : "Z"), r.offset && t.push("([+-]\\d{2}:?\\d{2})"), e = `${e}(${t.join("|")})`, new RegExp(`^${e}$`);
}
function mn(r, e) {
  return !!((e === "v4" || !e) && an.test(r) || (e === "v6" || !e) && on.test(r));
}
function vn(r, e) {
  if (!en.test(r))
    return !1;
  try {
    const [t] = r.split(".");
    if (!t)
      return !1;
    const n = t.replace(/-/g, "+").replace(/_/g, "/").padEnd(t.length + (4 - t.length % 4) % 4, "="), a = JSON.parse(atob(n));
    return !(typeof a != "object" || a === null || "typ" in a && (a == null ? void 0 : a.typ) !== "JWT" || !a.alg || e && a.alg !== e);
  } catch {
    return !1;
  }
}
function pn(r, e) {
  return !!((e === "v4" || !e) && sn.test(r) || (e === "v6" || !e) && cn.test(r));
}
class Ye extends K {
  _parse(e) {
    if (this._def.coerce && (e.data = String(e.data)), this._getType(e) !== x.string) {
      const s = this._getOrReturnCtx(e);
      return m(s, {
        code: l.invalid_type,
        expected: x.string,
        received: s.parsedType
      }), Z;
    }
    const n = new Ie();
    let a;
    for (const s of this._def.checks)
      if (s.kind === "min")
        e.data.length < s.value && (a = this._getOrReturnCtx(e, a), m(a, {
          code: l.too_small,
          minimum: s.value,
          type: "string",
          inclusive: !0,
          exact: !1,
          message: s.message
        }), n.dirty());
      else if (s.kind === "max")
        e.data.length > s.value && (a = this._getOrReturnCtx(e, a), m(a, {
          code: l.too_big,
          maximum: s.value,
          type: "string",
          inclusive: !0,
          exact: !1,
          message: s.message
        }), n.dirty());
      else if (s.kind === "length") {
        const i = e.data.length > s.value, c = e.data.length < s.value;
        (i || c) && (a = this._getOrReturnCtx(e, a), i ? m(a, {
          code: l.too_big,
          maximum: s.value,
          type: "string",
          inclusive: !0,
          exact: !0,
          message: s.message
        }) : c && m(a, {
          code: l.too_small,
          minimum: s.value,
          type: "string",
          inclusive: !0,
          exact: !0,
          message: s.message
        }), n.dirty());
      } else if (s.kind === "email")
        rn.test(e.data) || (a = this._getOrReturnCtx(e, a), m(a, {
          validation: "email",
          code: l.invalid_string,
          message: s.message
        }), n.dirty());
      else if (s.kind === "emoji")
        jt || (jt = new RegExp(nn, "u")), jt.test(e.data) || (a = this._getOrReturnCtx(e, a), m(a, {
          validation: "emoji",
          code: l.invalid_string,
          message: s.message
        }), n.dirty());
      else if (s.kind === "uuid")
        Qr.test(e.data) || (a = this._getOrReturnCtx(e, a), m(a, {
          validation: "uuid",
          code: l.invalid_string,
          message: s.message
        }), n.dirty());
      else if (s.kind === "nanoid")
        Kr.test(e.data) || (a = this._getOrReturnCtx(e, a), m(a, {
          validation: "nanoid",
          code: l.invalid_string,
          message: s.message
        }), n.dirty());
      else if (s.kind === "cuid")
        zr.test(e.data) || (a = this._getOrReturnCtx(e, a), m(a, {
          validation: "cuid",
          code: l.invalid_string,
          message: s.message
        }), n.dirty());
      else if (s.kind === "cuid2")
        Jr.test(e.data) || (a = this._getOrReturnCtx(e, a), m(a, {
          validation: "cuid2",
          code: l.invalid_string,
          message: s.message
        }), n.dirty());
      else if (s.kind === "ulid")
        Gr.test(e.data) || (a = this._getOrReturnCtx(e, a), m(a, {
          validation: "ulid",
          code: l.invalid_string,
          message: s.message
        }), n.dirty());
      else if (s.kind === "url")
        try {
          new URL(e.data);
        } catch {
          a = this._getOrReturnCtx(e, a), m(a, {
            validation: "url",
            code: l.invalid_string,
            message: s.message
          }), n.dirty();
        }
      else s.kind === "regex" ? (s.regex.lastIndex = 0, s.regex.test(e.data) || (a = this._getOrReturnCtx(e, a), m(a, {
        validation: "regex",
        code: l.invalid_string,
        message: s.message
      }), n.dirty())) : s.kind === "trim" ? e.data = e.data.trim() : s.kind === "includes" ? e.data.includes(s.value, s.position) || (a = this._getOrReturnCtx(e, a), m(a, {
        code: l.invalid_string,
        validation: { includes: s.value, position: s.position },
        message: s.message
      }), n.dirty()) : s.kind === "toLowerCase" ? e.data = e.data.toLowerCase() : s.kind === "toUpperCase" ? e.data = e.data.toUpperCase() : s.kind === "startsWith" ? e.data.startsWith(s.value) || (a = this._getOrReturnCtx(e, a), m(a, {
        code: l.invalid_string,
        validation: { startsWith: s.value },
        message: s.message
      }), n.dirty()) : s.kind === "endsWith" ? e.data.endsWith(s.value) || (a = this._getOrReturnCtx(e, a), m(a, {
        code: l.invalid_string,
        validation: { endsWith: s.value },
        message: s.message
      }), n.dirty()) : s.kind === "datetime" ? hn(s).test(e.data) || (a = this._getOrReturnCtx(e, a), m(a, {
        code: l.invalid_string,
        validation: "datetime",
        message: s.message
      }), n.dirty()) : s.kind === "date" ? un.test(e.data) || (a = this._getOrReturnCtx(e, a), m(a, {
        code: l.invalid_string,
        validation: "date",
        message: s.message
      }), n.dirty()) : s.kind === "time" ? fn(s).test(e.data) || (a = this._getOrReturnCtx(e, a), m(a, {
        code: l.invalid_string,
        validation: "time",
        message: s.message
      }), n.dirty()) : s.kind === "duration" ? tn.test(e.data) || (a = this._getOrReturnCtx(e, a), m(a, {
        validation: "duration",
        code: l.invalid_string,
        message: s.message
      }), n.dirty()) : s.kind === "ip" ? mn(e.data, s.version) || (a = this._getOrReturnCtx(e, a), m(a, {
        validation: "ip",
        code: l.invalid_string,
        message: s.message
      }), n.dirty()) : s.kind === "jwt" ? vn(e.data, s.alg) || (a = this._getOrReturnCtx(e, a), m(a, {
        validation: "jwt",
        code: l.invalid_string,
        message: s.message
      }), n.dirty()) : s.kind === "cidr" ? pn(e.data, s.version) || (a = this._getOrReturnCtx(e, a), m(a, {
        validation: "cidr",
        code: l.invalid_string,
        message: s.message
      }), n.dirty()) : s.kind === "base64" ? dn.test(e.data) || (a = this._getOrReturnCtx(e, a), m(a, {
        validation: "base64",
        code: l.invalid_string,
        message: s.message
      }), n.dirty()) : s.kind === "base64url" ? ln.test(e.data) || (a = this._getOrReturnCtx(e, a), m(a, {
        validation: "base64url",
        code: l.invalid_string,
        message: s.message
      }), n.dirty()) : ue.assertNever(s);
    return { status: n.value, value: e.data };
  }
  _regex(e, t, n) {
    return this.refinement((a) => e.test(a), {
      validation: t,
      code: l.invalid_string,
      ...k.errToObj(n)
    });
  }
  _addCheck(e) {
    return new Ye({
      ...this._def,
      checks: [...this._def.checks, e]
    });
  }
  email(e) {
    return this._addCheck({ kind: "email", ...k.errToObj(e) });
  }
  url(e) {
    return this._addCheck({ kind: "url", ...k.errToObj(e) });
  }
  emoji(e) {
    return this._addCheck({ kind: "emoji", ...k.errToObj(e) });
  }
  uuid(e) {
    return this._addCheck({ kind: "uuid", ...k.errToObj(e) });
  }
  nanoid(e) {
    return this._addCheck({ kind: "nanoid", ...k.errToObj(e) });
  }
  cuid(e) {
    return this._addCheck({ kind: "cuid", ...k.errToObj(e) });
  }
  cuid2(e) {
    return this._addCheck({ kind: "cuid2", ...k.errToObj(e) });
  }
  ulid(e) {
    return this._addCheck({ kind: "ulid", ...k.errToObj(e) });
  }
  base64(e) {
    return this._addCheck({ kind: "base64", ...k.errToObj(e) });
  }
  base64url(e) {
    return this._addCheck({
      kind: "base64url",
      ...k.errToObj(e)
    });
  }
  jwt(e) {
    return this._addCheck({ kind: "jwt", ...k.errToObj(e) });
  }
  ip(e) {
    return this._addCheck({ kind: "ip", ...k.errToObj(e) });
  }
  cidr(e) {
    return this._addCheck({ kind: "cidr", ...k.errToObj(e) });
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
      ...k.errToObj(e == null ? void 0 : e.message)
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
      ...k.errToObj(e == null ? void 0 : e.message)
    });
  }
  duration(e) {
    return this._addCheck({ kind: "duration", ...k.errToObj(e) });
  }
  regex(e, t) {
    return this._addCheck({
      kind: "regex",
      regex: e,
      ...k.errToObj(t)
    });
  }
  includes(e, t) {
    return this._addCheck({
      kind: "includes",
      value: e,
      position: t == null ? void 0 : t.position,
      ...k.errToObj(t == null ? void 0 : t.message)
    });
  }
  startsWith(e, t) {
    return this._addCheck({
      kind: "startsWith",
      value: e,
      ...k.errToObj(t)
    });
  }
  endsWith(e, t) {
    return this._addCheck({
      kind: "endsWith",
      value: e,
      ...k.errToObj(t)
    });
  }
  min(e, t) {
    return this._addCheck({
      kind: "min",
      value: e,
      ...k.errToObj(t)
    });
  }
  max(e, t) {
    return this._addCheck({
      kind: "max",
      value: e,
      ...k.errToObj(t)
    });
  }
  length(e, t) {
    return this._addCheck({
      kind: "length",
      value: e,
      ...k.errToObj(t)
    });
  }
  /**
   * Equivalent to `.min(1)`
   */
  nonempty(e) {
    return this.min(1, k.errToObj(e));
  }
  trim() {
    return new Ye({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }]
    });
  }
  toLowerCase() {
    return new Ye({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }]
    });
  }
  toUpperCase() {
    return new Ye({
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
Ye.create = (r) => new Ye({
  checks: [],
  typeName: M.ZodString,
  coerce: (r == null ? void 0 : r.coerce) ?? !1,
  ...Y(r)
});
function xn(r, e) {
  const t = (r.toString().split(".")[1] || "").length, n = (e.toString().split(".")[1] || "").length, a = t > n ? t : n, s = Number.parseInt(r.toFixed(a).replace(".", "")), i = Number.parseInt(e.toFixed(a).replace(".", ""));
  return s % i / 10 ** a;
}
class dt extends K {
  constructor() {
    super(...arguments), this.min = this.gte, this.max = this.lte, this.step = this.multipleOf;
  }
  _parse(e) {
    if (this._def.coerce && (e.data = Number(e.data)), this._getType(e) !== x.number) {
      const s = this._getOrReturnCtx(e);
      return m(s, {
        code: l.invalid_type,
        expected: x.number,
        received: s.parsedType
      }), Z;
    }
    let n;
    const a = new Ie();
    for (const s of this._def.checks)
      s.kind === "int" ? ue.isInteger(e.data) || (n = this._getOrReturnCtx(e, n), m(n, {
        code: l.invalid_type,
        expected: "integer",
        received: "float",
        message: s.message
      }), a.dirty()) : s.kind === "min" ? (s.inclusive ? e.data < s.value : e.data <= s.value) && (n = this._getOrReturnCtx(e, n), m(n, {
        code: l.too_small,
        minimum: s.value,
        type: "number",
        inclusive: s.inclusive,
        exact: !1,
        message: s.message
      }), a.dirty()) : s.kind === "max" ? (s.inclusive ? e.data > s.value : e.data >= s.value) && (n = this._getOrReturnCtx(e, n), m(n, {
        code: l.too_big,
        maximum: s.value,
        type: "number",
        inclusive: s.inclusive,
        exact: !1,
        message: s.message
      }), a.dirty()) : s.kind === "multipleOf" ? xn(e.data, s.value) !== 0 && (n = this._getOrReturnCtx(e, n), m(n, {
        code: l.not_multiple_of,
        multipleOf: s.value,
        message: s.message
      }), a.dirty()) : s.kind === "finite" ? Number.isFinite(e.data) || (n = this._getOrReturnCtx(e, n), m(n, {
        code: l.not_finite,
        message: s.message
      }), a.dirty()) : ue.assertNever(s);
    return { status: a.value, value: e.data };
  }
  gte(e, t) {
    return this.setLimit("min", e, !0, k.toString(t));
  }
  gt(e, t) {
    return this.setLimit("min", e, !1, k.toString(t));
  }
  lte(e, t) {
    return this.setLimit("max", e, !0, k.toString(t));
  }
  lt(e, t) {
    return this.setLimit("max", e, !1, k.toString(t));
  }
  setLimit(e, t, n, a) {
    return new dt({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind: e,
          value: t,
          inclusive: n,
          message: k.toString(a)
        }
      ]
    });
  }
  _addCheck(e) {
    return new dt({
      ...this._def,
      checks: [...this._def.checks, e]
    });
  }
  int(e) {
    return this._addCheck({
      kind: "int",
      message: k.toString(e)
    });
  }
  positive(e) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: !1,
      message: k.toString(e)
    });
  }
  negative(e) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: !1,
      message: k.toString(e)
    });
  }
  nonpositive(e) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: !0,
      message: k.toString(e)
    });
  }
  nonnegative(e) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: !0,
      message: k.toString(e)
    });
  }
  multipleOf(e, t) {
    return this._addCheck({
      kind: "multipleOf",
      value: e,
      message: k.toString(t)
    });
  }
  finite(e) {
    return this._addCheck({
      kind: "finite",
      message: k.toString(e)
    });
  }
  safe(e) {
    return this._addCheck({
      kind: "min",
      inclusive: !0,
      value: Number.MIN_SAFE_INTEGER,
      message: k.toString(e)
    })._addCheck({
      kind: "max",
      inclusive: !0,
      value: Number.MAX_SAFE_INTEGER,
      message: k.toString(e)
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
    return !!this._def.checks.find((e) => e.kind === "int" || e.kind === "multipleOf" && ue.isInteger(e.value));
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
dt.create = (r) => new dt({
  checks: [],
  typeName: M.ZodNumber,
  coerce: (r == null ? void 0 : r.coerce) || !1,
  ...Y(r)
});
class pt extends K {
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
    if (this._getType(e) !== x.bigint)
      return this._getInvalidInput(e);
    let n;
    const a = new Ie();
    for (const s of this._def.checks)
      s.kind === "min" ? (s.inclusive ? e.data < s.value : e.data <= s.value) && (n = this._getOrReturnCtx(e, n), m(n, {
        code: l.too_small,
        type: "bigint",
        minimum: s.value,
        inclusive: s.inclusive,
        message: s.message
      }), a.dirty()) : s.kind === "max" ? (s.inclusive ? e.data > s.value : e.data >= s.value) && (n = this._getOrReturnCtx(e, n), m(n, {
        code: l.too_big,
        type: "bigint",
        maximum: s.value,
        inclusive: s.inclusive,
        message: s.message
      }), a.dirty()) : s.kind === "multipleOf" ? e.data % s.value !== BigInt(0) && (n = this._getOrReturnCtx(e, n), m(n, {
        code: l.not_multiple_of,
        multipleOf: s.value,
        message: s.message
      }), a.dirty()) : ue.assertNever(s);
    return { status: a.value, value: e.data };
  }
  _getInvalidInput(e) {
    const t = this._getOrReturnCtx(e);
    return m(t, {
      code: l.invalid_type,
      expected: x.bigint,
      received: t.parsedType
    }), Z;
  }
  gte(e, t) {
    return this.setLimit("min", e, !0, k.toString(t));
  }
  gt(e, t) {
    return this.setLimit("min", e, !1, k.toString(t));
  }
  lte(e, t) {
    return this.setLimit("max", e, !0, k.toString(t));
  }
  lt(e, t) {
    return this.setLimit("max", e, !1, k.toString(t));
  }
  setLimit(e, t, n, a) {
    return new pt({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind: e,
          value: t,
          inclusive: n,
          message: k.toString(a)
        }
      ]
    });
  }
  _addCheck(e) {
    return new pt({
      ...this._def,
      checks: [...this._def.checks, e]
    });
  }
  positive(e) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: !1,
      message: k.toString(e)
    });
  }
  negative(e) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: !1,
      message: k.toString(e)
    });
  }
  nonpositive(e) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: !0,
      message: k.toString(e)
    });
  }
  nonnegative(e) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: !0,
      message: k.toString(e)
    });
  }
  multipleOf(e, t) {
    return this._addCheck({
      kind: "multipleOf",
      value: e,
      message: k.toString(t)
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
pt.create = (r) => new pt({
  checks: [],
  typeName: M.ZodBigInt,
  coerce: (r == null ? void 0 : r.coerce) ?? !1,
  ...Y(r)
});
class Vt extends K {
  _parse(e) {
    if (this._def.coerce && (e.data = !!e.data), this._getType(e) !== x.boolean) {
      const n = this._getOrReturnCtx(e);
      return m(n, {
        code: l.invalid_type,
        expected: x.boolean,
        received: n.parsedType
      }), Z;
    }
    return $e(e.data);
  }
}
Vt.create = (r) => new Vt({
  typeName: M.ZodBoolean,
  coerce: (r == null ? void 0 : r.coerce) || !1,
  ...Y(r)
});
class Ct extends K {
  _parse(e) {
    if (this._def.coerce && (e.data = new Date(e.data)), this._getType(e) !== x.date) {
      const s = this._getOrReturnCtx(e);
      return m(s, {
        code: l.invalid_type,
        expected: x.date,
        received: s.parsedType
      }), Z;
    }
    if (Number.isNaN(e.data.getTime())) {
      const s = this._getOrReturnCtx(e);
      return m(s, {
        code: l.invalid_date
      }), Z;
    }
    const n = new Ie();
    let a;
    for (const s of this._def.checks)
      s.kind === "min" ? e.data.getTime() < s.value && (a = this._getOrReturnCtx(e, a), m(a, {
        code: l.too_small,
        message: s.message,
        inclusive: !0,
        exact: !1,
        minimum: s.value,
        type: "date"
      }), n.dirty()) : s.kind === "max" ? e.data.getTime() > s.value && (a = this._getOrReturnCtx(e, a), m(a, {
        code: l.too_big,
        message: s.message,
        inclusive: !0,
        exact: !1,
        maximum: s.value,
        type: "date"
      }), n.dirty()) : ue.assertNever(s);
    return {
      status: n.value,
      value: new Date(e.data.getTime())
    };
  }
  _addCheck(e) {
    return new Ct({
      ...this._def,
      checks: [...this._def.checks, e]
    });
  }
  min(e, t) {
    return this._addCheck({
      kind: "min",
      value: e.getTime(),
      message: k.toString(t)
    });
  }
  max(e, t) {
    return this._addCheck({
      kind: "max",
      value: e.getTime(),
      message: k.toString(t)
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
Ct.create = (r) => new Ct({
  checks: [],
  coerce: (r == null ? void 0 : r.coerce) || !1,
  typeName: M.ZodDate,
  ...Y(r)
});
class gr extends K {
  _parse(e) {
    if (this._getType(e) !== x.symbol) {
      const n = this._getOrReturnCtx(e);
      return m(n, {
        code: l.invalid_type,
        expected: x.symbol,
        received: n.parsedType
      }), Z;
    }
    return $e(e.data);
  }
}
gr.create = (r) => new gr({
  typeName: M.ZodSymbol,
  ...Y(r)
});
class Dt extends K {
  _parse(e) {
    if (this._getType(e) !== x.undefined) {
      const n = this._getOrReturnCtx(e);
      return m(n, {
        code: l.invalid_type,
        expected: x.undefined,
        received: n.parsedType
      }), Z;
    }
    return $e(e.data);
  }
}
Dt.create = (r) => new Dt({
  typeName: M.ZodUndefined,
  ...Y(r)
});
class Ut extends K {
  _parse(e) {
    if (this._getType(e) !== x.null) {
      const n = this._getOrReturnCtx(e);
      return m(n, {
        code: l.invalid_type,
        expected: x.null,
        received: n.parsedType
      }), Z;
    }
    return $e(e.data);
  }
}
Ut.create = (r) => new Ut({
  typeName: M.ZodNull,
  ...Y(r)
});
class yr extends K {
  constructor() {
    super(...arguments), this._any = !0;
  }
  _parse(e) {
    return $e(e.data);
  }
}
yr.create = (r) => new yr({
  typeName: M.ZodAny,
  ...Y(r)
});
class Bt extends K {
  constructor() {
    super(...arguments), this._unknown = !0;
  }
  _parse(e) {
    return $e(e.data);
  }
}
Bt.create = (r) => new Bt({
  typeName: M.ZodUnknown,
  ...Y(r)
});
class Qe extends K {
  _parse(e) {
    const t = this._getOrReturnCtx(e);
    return m(t, {
      code: l.invalid_type,
      expected: x.never,
      received: t.parsedType
    }), Z;
  }
}
Qe.create = (r) => new Qe({
  typeName: M.ZodNever,
  ...Y(r)
});
class _r extends K {
  _parse(e) {
    if (this._getType(e) !== x.undefined) {
      const n = this._getOrReturnCtx(e);
      return m(n, {
        code: l.invalid_type,
        expected: x.void,
        received: n.parsedType
      }), Z;
    }
    return $e(e.data);
  }
}
_r.create = (r) => new _r({
  typeName: M.ZodVoid,
  ...Y(r)
});
class De extends K {
  _parse(e) {
    const { ctx: t, status: n } = this._processInputParams(e), a = this._def;
    if (t.parsedType !== x.array)
      return m(t, {
        code: l.invalid_type,
        expected: x.array,
        received: t.parsedType
      }), Z;
    if (a.exactLength !== null) {
      const i = t.data.length > a.exactLength.value, c = t.data.length < a.exactLength.value;
      (i || c) && (m(t, {
        code: i ? l.too_big : l.too_small,
        minimum: c ? a.exactLength.value : void 0,
        maximum: i ? a.exactLength.value : void 0,
        type: "array",
        inclusive: !0,
        exact: !0,
        message: a.exactLength.message
      }), n.dirty());
    }
    if (a.minLength !== null && t.data.length < a.minLength.value && (m(t, {
      code: l.too_small,
      minimum: a.minLength.value,
      type: "array",
      inclusive: !0,
      exact: !1,
      message: a.minLength.message
    }), n.dirty()), a.maxLength !== null && t.data.length > a.maxLength.value && (m(t, {
      code: l.too_big,
      maximum: a.maxLength.value,
      type: "array",
      inclusive: !0,
      exact: !1,
      message: a.maxLength.message
    }), n.dirty()), t.common.async)
      return Promise.all([...t.data].map((i, c) => a.type._parseAsync(new Ue(t, i, t.path, c)))).then((i) => Ie.mergeArray(n, i));
    const s = [...t.data].map((i, c) => a.type._parseSync(new Ue(t, i, t.path, c)));
    return Ie.mergeArray(n, s);
  }
  get element() {
    return this._def.type;
  }
  min(e, t) {
    return new De({
      ...this._def,
      minLength: { value: e, message: k.toString(t) }
    });
  }
  max(e, t) {
    return new De({
      ...this._def,
      maxLength: { value: e, message: k.toString(t) }
    });
  }
  length(e, t) {
    return new De({
      ...this._def,
      exactLength: { value: e, message: k.toString(t) }
    });
  }
  nonempty(e) {
    return this.min(1, e);
  }
}
De.create = (r, e) => new De({
  type: r,
  minLength: null,
  maxLength: null,
  exactLength: null,
  typeName: M.ZodArray,
  ...Y(e)
});
function ot(r) {
  if (r instanceof ke) {
    const e = {};
    for (const t in r.shape) {
      const n = r.shape[t];
      e[t] = qe.create(ot(n));
    }
    return new ke({
      ...r._def,
      shape: () => e
    });
  } else return r instanceof De ? new De({
    ...r._def,
    type: ot(r.element)
  }) : r instanceof qe ? qe.create(ot(r.unwrap())) : r instanceof nt ? nt.create(ot(r.unwrap())) : r instanceof et ? et.create(r.items.map((e) => ot(e))) : r;
}
class ke extends K {
  constructor() {
    super(...arguments), this._cached = null, this.nonstrict = this.passthrough, this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null)
      return this._cached;
    const e = this._def.shape(), t = ue.objectKeys(e);
    return this._cached = { shape: e, keys: t }, this._cached;
  }
  _parse(e) {
    if (this._getType(e) !== x.object) {
      const y = this._getOrReturnCtx(e);
      return m(y, {
        code: l.invalid_type,
        expected: x.object,
        received: y.parsedType
      }), Z;
    }
    const { status: n, ctx: a } = this._processInputParams(e), { shape: s, keys: i } = this._getCached(), c = [];
    if (!(this._def.catchall instanceof Qe && this._def.unknownKeys === "strip"))
      for (const y in a.data)
        i.includes(y) || c.push(y);
    const h = [];
    for (const y of i) {
      const P = s[y], we = a.data[y];
      h.push({
        key: { status: "valid", value: y },
        value: P._parse(new Ue(a, we, a.path, y)),
        alwaysSet: y in a.data
      });
    }
    if (this._def.catchall instanceof Qe) {
      const y = this._def.unknownKeys;
      if (y === "passthrough")
        for (const P of c)
          h.push({
            key: { status: "valid", value: P },
            value: { status: "valid", value: a.data[P] }
          });
      else if (y === "strict")
        c.length > 0 && (m(a, {
          code: l.unrecognized_keys,
          keys: c
        }), n.dirty());
      else if (y !== "strip") throw new Error("Internal ZodObject error: invalid unknownKeys value.");
    } else {
      const y = this._def.catchall;
      for (const P of c) {
        const we = a.data[P];
        h.push({
          key: { status: "valid", value: P },
          value: y._parse(
            new Ue(a, we, a.path, P)
            //, ctx.child(key), value, getParsedType(value)
          ),
          alwaysSet: P in a.data
        });
      }
    }
    return a.common.async ? Promise.resolve().then(async () => {
      const y = [];
      for (const P of h) {
        const we = await P.key, Ee = await P.value;
        y.push({
          key: we,
          value: Ee,
          alwaysSet: P.alwaysSet
        });
      }
      return y;
    }).then((y) => Ie.mergeObjectSync(n, y)) : Ie.mergeObjectSync(n, h);
  }
  get shape() {
    return this._def.shape();
  }
  strict(e) {
    return k.errToObj, new ke({
      ...this._def,
      unknownKeys: "strict",
      ...e !== void 0 ? {
        errorMap: (t, n) => {
          var s, i;
          const a = ((i = (s = this._def).errorMap) == null ? void 0 : i.call(s, t, n).message) ?? n.defaultError;
          return t.code === "unrecognized_keys" ? {
            message: k.errToObj(e).message ?? a
          } : {
            message: a
          };
        }
      } : {}
    });
  }
  strip() {
    return new ke({
      ...this._def,
      unknownKeys: "strip"
    });
  }
  passthrough() {
    return new ke({
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
    return new ke({
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
    return new ke({
      unknownKeys: e._def.unknownKeys,
      catchall: e._def.catchall,
      shape: () => ({
        ...this._def.shape(),
        ...e._def.shape()
      }),
      typeName: M.ZodObject
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
    return new ke({
      ...this._def,
      catchall: e
    });
  }
  pick(e) {
    const t = {};
    for (const n of ue.objectKeys(e))
      e[n] && this.shape[n] && (t[n] = this.shape[n]);
    return new ke({
      ...this._def,
      shape: () => t
    });
  }
  omit(e) {
    const t = {};
    for (const n of ue.objectKeys(this.shape))
      e[n] || (t[n] = this.shape[n]);
    return new ke({
      ...this._def,
      shape: () => t
    });
  }
  /**
   * @deprecated
   */
  deepPartial() {
    return ot(this);
  }
  partial(e) {
    const t = {};
    for (const n of ue.objectKeys(this.shape)) {
      const a = this.shape[n];
      e && !e[n] ? t[n] = a : t[n] = a.optional();
    }
    return new ke({
      ...this._def,
      shape: () => t
    });
  }
  required(e) {
    const t = {};
    for (const n of ue.objectKeys(this.shape))
      if (e && !e[n])
        t[n] = this.shape[n];
      else {
        let s = this.shape[n];
        for (; s instanceof qe; )
          s = s._def.innerType;
        t[n] = s;
      }
    return new ke({
      ...this._def,
      shape: () => t
    });
  }
  keyof() {
    return Nr(ue.objectKeys(this.shape));
  }
}
ke.create = (r, e) => new ke({
  shape: () => r,
  unknownKeys: "strip",
  catchall: Qe.create(),
  typeName: M.ZodObject,
  ...Y(e)
});
ke.strictCreate = (r, e) => new ke({
  shape: () => r,
  unknownKeys: "strict",
  catchall: Qe.create(),
  typeName: M.ZodObject,
  ...Y(e)
});
ke.lazycreate = (r, e) => new ke({
  shape: r,
  unknownKeys: "strip",
  catchall: Qe.create(),
  typeName: M.ZodObject,
  ...Y(e)
});
class At extends K {
  _parse(e) {
    const { ctx: t } = this._processInputParams(e), n = this._def.options;
    function a(s) {
      for (const c of s)
        if (c.result.status === "valid")
          return c.result;
      for (const c of s)
        if (c.result.status === "dirty")
          return t.common.issues.push(...c.ctx.common.issues), c.result;
      const i = s.map((c) => new He(c.ctx.common.issues));
      return m(t, {
        code: l.invalid_union,
        unionErrors: i
      }), Z;
    }
    if (t.common.async)
      return Promise.all(n.map(async (s) => {
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
      for (const h of n) {
        const y = {
          ...t,
          common: {
            ...t.common,
            issues: []
          },
          parent: null
        }, P = h._parseSync({
          data: t.data,
          path: t.path,
          parent: y
        });
        if (P.status === "valid")
          return P;
        P.status === "dirty" && !s && (s = { result: P, ctx: y }), y.common.issues.length && i.push(y.common.issues);
      }
      if (s)
        return t.common.issues.push(...s.ctx.common.issues), s.result;
      const c = i.map((h) => new He(h));
      return m(t, {
        code: l.invalid_union,
        unionErrors: c
      }), Z;
    }
  }
  get options() {
    return this._def.options;
  }
}
At.create = (r, e) => new At({
  options: r,
  typeName: M.ZodUnion,
  ...Y(e)
});
const We = (r) => r instanceof Yt ? We(r.schema) : r instanceof rt ? We(r.innerType()) : r instanceof It ? [r.value] : r instanceof tt ? r.options : r instanceof qt ? ue.objectValues(r.enum) : r instanceof Rt ? We(r._def.innerType) : r instanceof Dt ? [void 0] : r instanceof Ut ? [null] : r instanceof qe ? [void 0, ...We(r.unwrap())] : r instanceof nt ? [null, ...We(r.unwrap())] : r instanceof Zr || r instanceof Nt ? We(r.unwrap()) : r instanceof Ot ? We(r._def.innerType) : [];
class Xt extends K {
  _parse(e) {
    const { ctx: t } = this._processInputParams(e);
    if (t.parsedType !== x.object)
      return m(t, {
        code: l.invalid_type,
        expected: x.object,
        received: t.parsedType
      }), Z;
    const n = this.discriminator, a = t.data[n], s = this.optionsMap.get(a);
    return s ? t.common.async ? s._parseAsync({
      data: t.data,
      path: t.path,
      parent: t
    }) : s._parseSync({
      data: t.data,
      path: t.path,
      parent: t
    }) : (m(t, {
      code: l.invalid_union_discriminator,
      options: Array.from(this.optionsMap.keys()),
      path: [n]
    }), Z);
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
    const a = /* @__PURE__ */ new Map();
    for (const s of t) {
      const i = We(s.shape[e]);
      if (!i.length)
        throw new Error(`A discriminator value for key \`${e}\` could not be extracted from all schema options`);
      for (const c of i) {
        if (a.has(c))
          throw new Error(`Discriminator property ${String(e)} has duplicate value ${String(c)}`);
        a.set(c, s);
      }
    }
    return new Xt({
      typeName: M.ZodDiscriminatedUnion,
      discriminator: e,
      options: t,
      optionsMap: a,
      ...Y(n)
    });
  }
}
function Wt(r, e) {
  const t = Je(r), n = Je(e);
  if (r === e)
    return { valid: !0, data: r };
  if (t === x.object && n === x.object) {
    const a = ue.objectKeys(e), s = ue.objectKeys(r).filter((c) => a.indexOf(c) !== -1), i = { ...r, ...e };
    for (const c of s) {
      const h = Wt(r[c], e[c]);
      if (!h.valid)
        return { valid: !1 };
      i[c] = h.data;
    }
    return { valid: !0, data: i };
  } else if (t === x.array && n === x.array) {
    if (r.length !== e.length)
      return { valid: !1 };
    const a = [];
    for (let s = 0; s < r.length; s++) {
      const i = r[s], c = e[s], h = Wt(i, c);
      if (!h.valid)
        return { valid: !1 };
      a.push(h.data);
    }
    return { valid: !0, data: a };
  } else return t === x.date && n === x.date && +r == +e ? { valid: !0, data: r } : { valid: !1 };
}
class St extends K {
  _parse(e) {
    const { status: t, ctx: n } = this._processInputParams(e), a = (s, i) => {
      if (vr(s) || vr(i))
        return Z;
      const c = Wt(s.value, i.value);
      return c.valid ? ((pr(s) || pr(i)) && t.dirty(), { status: t.value, value: c.data }) : (m(n, {
        code: l.invalid_intersection_types
      }), Z);
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
    ]).then(([s, i]) => a(s, i)) : a(this._def.left._parseSync({
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
St.create = (r, e, t) => new St({
  left: r,
  right: e,
  typeName: M.ZodIntersection,
  ...Y(t)
});
class et extends K {
  _parse(e) {
    const { status: t, ctx: n } = this._processInputParams(e);
    if (n.parsedType !== x.array)
      return m(n, {
        code: l.invalid_type,
        expected: x.array,
        received: n.parsedType
      }), Z;
    if (n.data.length < this._def.items.length)
      return m(n, {
        code: l.too_small,
        minimum: this._def.items.length,
        inclusive: !0,
        exact: !1,
        type: "array"
      }), Z;
    !this._def.rest && n.data.length > this._def.items.length && (m(n, {
      code: l.too_big,
      maximum: this._def.items.length,
      inclusive: !0,
      exact: !1,
      type: "array"
    }), t.dirty());
    const s = [...n.data].map((i, c) => {
      const h = this._def.items[c] || this._def.rest;
      return h ? h._parse(new Ue(n, i, n.path, c)) : null;
    }).filter((i) => !!i);
    return n.common.async ? Promise.all(s).then((i) => Ie.mergeArray(t, i)) : Ie.mergeArray(t, s);
  }
  get items() {
    return this._def.items;
  }
  rest(e) {
    return new et({
      ...this._def,
      rest: e
    });
  }
}
et.create = (r, e) => {
  if (!Array.isArray(r))
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  return new et({
    items: r,
    typeName: M.ZodTuple,
    rest: null,
    ...Y(e)
  });
};
class Et extends K {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(e) {
    const { status: t, ctx: n } = this._processInputParams(e);
    if (n.parsedType !== x.object)
      return m(n, {
        code: l.invalid_type,
        expected: x.object,
        received: n.parsedType
      }), Z;
    const a = [], s = this._def.keyType, i = this._def.valueType;
    for (const c in n.data)
      a.push({
        key: s._parse(new Ue(n, c, n.path, c)),
        value: i._parse(new Ue(n, n.data[c], n.path, c)),
        alwaysSet: c in n.data
      });
    return n.common.async ? Ie.mergeObjectAsync(t, a) : Ie.mergeObjectSync(t, a);
  }
  get element() {
    return this._def.valueType;
  }
  static create(e, t, n) {
    return t instanceof K ? new Et({
      keyType: e,
      valueType: t,
      typeName: M.ZodRecord,
      ...Y(n)
    }) : new Et({
      keyType: Ye.create(),
      valueType: e,
      typeName: M.ZodRecord,
      ...Y(t)
    });
  }
}
class br extends K {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(e) {
    const { status: t, ctx: n } = this._processInputParams(e);
    if (n.parsedType !== x.map)
      return m(n, {
        code: l.invalid_type,
        expected: x.map,
        received: n.parsedType
      }), Z;
    const a = this._def.keyType, s = this._def.valueType, i = [...n.data.entries()].map(([c, h], y) => ({
      key: a._parse(new Ue(n, c, n.path, [y, "key"])),
      value: s._parse(new Ue(n, h, n.path, [y, "value"]))
    }));
    if (n.common.async) {
      const c = /* @__PURE__ */ new Map();
      return Promise.resolve().then(async () => {
        for (const h of i) {
          const y = await h.key, P = await h.value;
          if (y.status === "aborted" || P.status === "aborted")
            return Z;
          (y.status === "dirty" || P.status === "dirty") && t.dirty(), c.set(y.value, P.value);
        }
        return { status: t.value, value: c };
      });
    } else {
      const c = /* @__PURE__ */ new Map();
      for (const h of i) {
        const y = h.key, P = h.value;
        if (y.status === "aborted" || P.status === "aborted")
          return Z;
        (y.status === "dirty" || P.status === "dirty") && t.dirty(), c.set(y.value, P.value);
      }
      return { status: t.value, value: c };
    }
  }
}
br.create = (r, e, t) => new br({
  valueType: e,
  keyType: r,
  typeName: M.ZodMap,
  ...Y(t)
});
class xt extends K {
  _parse(e) {
    const { status: t, ctx: n } = this._processInputParams(e);
    if (n.parsedType !== x.set)
      return m(n, {
        code: l.invalid_type,
        expected: x.set,
        received: n.parsedType
      }), Z;
    const a = this._def;
    a.minSize !== null && n.data.size < a.minSize.value && (m(n, {
      code: l.too_small,
      minimum: a.minSize.value,
      type: "set",
      inclusive: !0,
      exact: !1,
      message: a.minSize.message
    }), t.dirty()), a.maxSize !== null && n.data.size > a.maxSize.value && (m(n, {
      code: l.too_big,
      maximum: a.maxSize.value,
      type: "set",
      inclusive: !0,
      exact: !1,
      message: a.maxSize.message
    }), t.dirty());
    const s = this._def.valueType;
    function i(h) {
      const y = /* @__PURE__ */ new Set();
      for (const P of h) {
        if (P.status === "aborted")
          return Z;
        P.status === "dirty" && t.dirty(), y.add(P.value);
      }
      return { status: t.value, value: y };
    }
    const c = [...n.data.values()].map((h, y) => s._parse(new Ue(n, h, n.path, y)));
    return n.common.async ? Promise.all(c).then((h) => i(h)) : i(c);
  }
  min(e, t) {
    return new xt({
      ...this._def,
      minSize: { value: e, message: k.toString(t) }
    });
  }
  max(e, t) {
    return new xt({
      ...this._def,
      maxSize: { value: e, message: k.toString(t) }
    });
  }
  size(e, t) {
    return this.min(e, t).max(e, t);
  }
  nonempty(e) {
    return this.min(1, e);
  }
}
xt.create = (r, e) => new xt({
  valueType: r,
  minSize: null,
  maxSize: null,
  typeName: M.ZodSet,
  ...Y(e)
});
class Yt extends K {
  get schema() {
    return this._def.getter();
  }
  _parse(e) {
    const { ctx: t } = this._processInputParams(e);
    return this._def.getter()._parse({ data: t.data, path: t.path, parent: t });
  }
}
Yt.create = (r, e) => new Yt({
  getter: r,
  typeName: M.ZodLazy,
  ...Y(e)
});
class It extends K {
  _parse(e) {
    if (e.data !== this._def.value) {
      const t = this._getOrReturnCtx(e);
      return m(t, {
        received: t.data,
        code: l.invalid_literal,
        expected: this._def.value
      }), Z;
    }
    return { status: "valid", value: e.data };
  }
  get value() {
    return this._def.value;
  }
}
It.create = (r, e) => new It({
  value: r,
  typeName: M.ZodLiteral,
  ...Y(e)
});
function Nr(r, e) {
  return new tt({
    values: r,
    typeName: M.ZodEnum,
    ...Y(e)
  });
}
class tt extends K {
  _parse(e) {
    if (typeof e.data != "string") {
      const t = this._getOrReturnCtx(e), n = this._def.values;
      return m(t, {
        expected: ue.joinValues(n),
        received: t.parsedType,
        code: l.invalid_type
      }), Z;
    }
    if (this._cache || (this._cache = new Set(this._def.values)), !this._cache.has(e.data)) {
      const t = this._getOrReturnCtx(e), n = this._def.values;
      return m(t, {
        received: t.data,
        code: l.invalid_enum_value,
        options: n
      }), Z;
    }
    return $e(e.data);
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
    return tt.create(e, {
      ...this._def,
      ...t
    });
  }
  exclude(e, t = this._def) {
    return tt.create(this.options.filter((n) => !e.includes(n)), {
      ...this._def,
      ...t
    });
  }
}
tt.create = Nr;
class qt extends K {
  _parse(e) {
    const t = ue.getValidEnumValues(this._def.values), n = this._getOrReturnCtx(e);
    if (n.parsedType !== x.string && n.parsedType !== x.number) {
      const a = ue.objectValues(t);
      return m(n, {
        expected: ue.joinValues(a),
        received: n.parsedType,
        code: l.invalid_type
      }), Z;
    }
    if (this._cache || (this._cache = new Set(ue.getValidEnumValues(this._def.values))), !this._cache.has(e.data)) {
      const a = ue.objectValues(t);
      return m(n, {
        received: n.data,
        code: l.invalid_enum_value,
        options: a
      }), Z;
    }
    return $e(e.data);
  }
  get enum() {
    return this._def.values;
  }
}
qt.create = (r, e) => new qt({
  values: r,
  typeName: M.ZodNativeEnum,
  ...Y(e)
});
class Ft extends K {
  unwrap() {
    return this._def.type;
  }
  _parse(e) {
    const { ctx: t } = this._processInputParams(e);
    if (t.parsedType !== x.promise && t.common.async === !1)
      return m(t, {
        code: l.invalid_type,
        expected: x.promise,
        received: t.parsedType
      }), Z;
    const n = t.parsedType === x.promise ? t.data : Promise.resolve(t.data);
    return $e(n.then((a) => this._def.type.parseAsync(a, {
      path: t.path,
      errorMap: t.common.contextualErrorMap
    })));
  }
}
Ft.create = (r, e) => new Ft({
  type: r,
  typeName: M.ZodPromise,
  ...Y(e)
});
class rt extends K {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === M.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(e) {
    const { status: t, ctx: n } = this._processInputParams(e), a = this._def.effect || null, s = {
      addIssue: (i) => {
        m(n, i), i.fatal ? t.abort() : t.dirty();
      },
      get path() {
        return n.path;
      }
    };
    if (s.addIssue = s.addIssue.bind(s), a.type === "preprocess") {
      const i = a.transform(n.data, s);
      if (n.common.async)
        return Promise.resolve(i).then(async (c) => {
          if (t.value === "aborted")
            return Z;
          const h = await this._def.schema._parseAsync({
            data: c,
            path: n.path,
            parent: n
          });
          return h.status === "aborted" ? Z : h.status === "dirty" || t.value === "dirty" ? mt(h.value) : h;
        });
      {
        if (t.value === "aborted")
          return Z;
        const c = this._def.schema._parseSync({
          data: i,
          path: n.path,
          parent: n
        });
        return c.status === "aborted" ? Z : c.status === "dirty" || t.value === "dirty" ? mt(c.value) : c;
      }
    }
    if (a.type === "refinement") {
      const i = (c) => {
        const h = a.refinement(c, s);
        if (n.common.async)
          return Promise.resolve(h);
        if (h instanceof Promise)
          throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        return c;
      };
      if (n.common.async === !1) {
        const c = this._def.schema._parseSync({
          data: n.data,
          path: n.path,
          parent: n
        });
        return c.status === "aborted" ? Z : (c.status === "dirty" && t.dirty(), i(c.value), { status: t.value, value: c.value });
      } else
        return this._def.schema._parseAsync({ data: n.data, path: n.path, parent: n }).then((c) => c.status === "aborted" ? Z : (c.status === "dirty" && t.dirty(), i(c.value).then(() => ({ status: t.value, value: c.value }))));
    }
    if (a.type === "transform")
      if (n.common.async === !1) {
        const i = this._def.schema._parseSync({
          data: n.data,
          path: n.path,
          parent: n
        });
        if (!ct(i))
          return Z;
        const c = a.transform(i.value, s);
        if (c instanceof Promise)
          throw new Error("Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.");
        return { status: t.value, value: c };
      } else
        return this._def.schema._parseAsync({ data: n.data, path: n.path, parent: n }).then((i) => ct(i) ? Promise.resolve(a.transform(i.value, s)).then((c) => ({
          status: t.value,
          value: c
        })) : Z);
    ue.assertNever(a);
  }
}
rt.create = (r, e, t) => new rt({
  schema: r,
  typeName: M.ZodEffects,
  effect: e,
  ...Y(t)
});
rt.createWithPreprocess = (r, e, t) => new rt({
  schema: e,
  effect: { type: "preprocess", transform: r },
  typeName: M.ZodEffects,
  ...Y(t)
});
class qe extends K {
  _parse(e) {
    return this._getType(e) === x.undefined ? $e(void 0) : this._def.innerType._parse(e);
  }
  unwrap() {
    return this._def.innerType;
  }
}
qe.create = (r, e) => new qe({
  innerType: r,
  typeName: M.ZodOptional,
  ...Y(e)
});
class nt extends K {
  _parse(e) {
    return this._getType(e) === x.null ? $e(null) : this._def.innerType._parse(e);
  }
  unwrap() {
    return this._def.innerType;
  }
}
nt.create = (r, e) => new nt({
  innerType: r,
  typeName: M.ZodNullable,
  ...Y(e)
});
class Rt extends K {
  _parse(e) {
    const { ctx: t } = this._processInputParams(e);
    let n = t.data;
    return t.parsedType === x.undefined && (n = this._def.defaultValue()), this._def.innerType._parse({
      data: n,
      path: t.path,
      parent: t
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
}
Rt.create = (r, e) => new Rt({
  innerType: r,
  typeName: M.ZodDefault,
  defaultValue: typeof e.default == "function" ? e.default : () => e.default,
  ...Y(e)
});
class Ot extends K {
  _parse(e) {
    const { ctx: t } = this._processInputParams(e), n = {
      ...t,
      common: {
        ...t.common,
        issues: []
      }
    }, a = this._def.innerType._parse({
      data: n.data,
      path: n.path,
      parent: {
        ...n
      }
    });
    return Tt(a) ? a.then((s) => ({
      status: "valid",
      value: s.status === "valid" ? s.value : this._def.catchValue({
        get error() {
          return new He(n.common.issues);
        },
        input: n.data
      })
    })) : {
      status: "valid",
      value: a.status === "valid" ? a.value : this._def.catchValue({
        get error() {
          return new He(n.common.issues);
        },
        input: n.data
      })
    };
  }
  removeCatch() {
    return this._def.innerType;
  }
}
Ot.create = (r, e) => new Ot({
  innerType: r,
  typeName: M.ZodCatch,
  catchValue: typeof e.catch == "function" ? e.catch : () => e.catch,
  ...Y(e)
});
class kr extends K {
  _parse(e) {
    if (this._getType(e) !== x.nan) {
      const n = this._getOrReturnCtx(e);
      return m(n, {
        code: l.invalid_type,
        expected: x.nan,
        received: n.parsedType
      }), Z;
    }
    return { status: "valid", value: e.data };
  }
}
kr.create = (r) => new kr({
  typeName: M.ZodNaN,
  ...Y(r)
});
class Zr extends K {
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
class zt extends K {
  _parse(e) {
    const { status: t, ctx: n } = this._processInputParams(e);
    if (n.common.async)
      return (async () => {
        const s = await this._def.in._parseAsync({
          data: n.data,
          path: n.path,
          parent: n
        });
        return s.status === "aborted" ? Z : s.status === "dirty" ? (t.dirty(), mt(s.value)) : this._def.out._parseAsync({
          data: s.value,
          path: n.path,
          parent: n
        });
      })();
    {
      const a = this._def.in._parseSync({
        data: n.data,
        path: n.path,
        parent: n
      });
      return a.status === "aborted" ? Z : a.status === "dirty" ? (t.dirty(), {
        status: "dirty",
        value: a.value
      }) : this._def.out._parseSync({
        data: a.value,
        path: n.path,
        parent: n
      });
    }
  }
  static create(e, t) {
    return new zt({
      in: e,
      out: t,
      typeName: M.ZodPipeline
    });
  }
}
class Nt extends K {
  _parse(e) {
    const t = this._def.innerType._parse(e), n = (a) => (ct(a) && (a.value = Object.freeze(a.value)), a);
    return Tt(t) ? t.then((a) => n(a)) : n(t);
  }
  unwrap() {
    return this._def.innerType;
  }
}
Nt.create = (r, e) => new Nt({
  innerType: r,
  typeName: M.ZodReadonly,
  ...Y(e)
});
var M;
(function(r) {
  r.ZodString = "ZodString", r.ZodNumber = "ZodNumber", r.ZodNaN = "ZodNaN", r.ZodBigInt = "ZodBigInt", r.ZodBoolean = "ZodBoolean", r.ZodDate = "ZodDate", r.ZodSymbol = "ZodSymbol", r.ZodUndefined = "ZodUndefined", r.ZodNull = "ZodNull", r.ZodAny = "ZodAny", r.ZodUnknown = "ZodUnknown", r.ZodNever = "ZodNever", r.ZodVoid = "ZodVoid", r.ZodArray = "ZodArray", r.ZodObject = "ZodObject", r.ZodUnion = "ZodUnion", r.ZodDiscriminatedUnion = "ZodDiscriminatedUnion", r.ZodIntersection = "ZodIntersection", r.ZodTuple = "ZodTuple", r.ZodRecord = "ZodRecord", r.ZodMap = "ZodMap", r.ZodSet = "ZodSet", r.ZodFunction = "ZodFunction", r.ZodLazy = "ZodLazy", r.ZodLiteral = "ZodLiteral", r.ZodEnum = "ZodEnum", r.ZodEffects = "ZodEffects", r.ZodNativeEnum = "ZodNativeEnum", r.ZodOptional = "ZodOptional", r.ZodNullable = "ZodNullable", r.ZodDefault = "ZodDefault", r.ZodCatch = "ZodCatch", r.ZodPromise = "ZodPromise", r.ZodBranded = "ZodBranded", r.ZodPipeline = "ZodPipeline", r.ZodReadonly = "ZodReadonly";
})(M || (M = {}));
const u = Ye.create, ge = dt.create, wr = Vt.create, Mr = Bt.create;
Qe.create;
const gn = De.create, le = ke.create;
At.create;
const Pr = Xt.create;
St.create;
et.create;
const $t = Et.create, Ze = It.create, Pe = tt.create;
Ft.create;
qe.create;
nt.create;
const yn = [
  "ingest",
  "normalize",
  "scene-detect",
  "dedup",
  "asr",
  "vision",
  "graph",
  "reason"
], Ve = Pe(yn), _n = Pr("type", [
  le({ type: Ze("run:start"), runId: u(), at: ge() }),
  le({ type: Ze("stage:start"), runId: u(), stage: Ve, attempt: ge().int().min(1) }),
  le({ type: Ze("stage:resumed"), runId: u(), stage: Ve }),
  // A stage that will never run for THIS source — no frames to dedup, no
  // backend to see them. Distinct from "waiting", which a user reads as
  // "still to come" and which never resolves.
  le({ type: Ze("stage:skipped"), runId: u(), stage: Ve, why: u() }),
  le({
    type: Ze("stage:progress"),
    runId: u(),
    stage: Ve,
    done: ge().int().min(0),
    total: ge().int().min(0),
    note: u().optional()
  }),
  le({ type: Ze("stage:done"), runId: u(), stage: Ve, ms: ge().min(0) }),
  le({
    type: Ze("stage:degraded"),
    runId: u(),
    stage: Ve,
    code: u(),
    message: u()
  }),
  le({ type: Ze("run:done"), runId: u(), ms: ge().min(0) }),
  le({
    type: Ze("run:failed"),
    runId: u(),
    stage: Ve.nullable(),
    code: u(),
    message: u()
  }),
  le({ type: Ze("run:cancelled"), runId: u(), stage: Ve.nullable() })
]), bn = Pe(["url", "file"]), kn = Pe(["claimed", "running", "succeeded", "failed", "cancelled"]), wn = Pe(["audio", "visual", "both"]);
le({
  id: u(),
  kind: bn,
  uri: u(),
  contentSha256: u().length(64).nullable(),
  title: u().nullable(),
  durationS: ge().positive().nullable(),
  hasAudio: wr(),
  hasVideo: wr(),
  createdAt: ge().int()
});
le({
  id: u(),
  sourceId: u(),
  schemaRevisionId: u().nullable(),
  status: kn,
  stagePointer: Ve.nullable(),
  errorCode: u().nullable(),
  errorMessage: u().nullable(),
  leaseOwner: u().nullable(),
  leaseExpiresAt: ge().int().nullable(),
  createdAt: ge().int(),
  startedAt: ge().int().nullable(),
  finishedAt: ge().int().nullable()
});
le({
  runId: u(),
  stage: Ve,
  attempt: ge().int().min(1),
  inputHash: u(),
  status: Pe(["running", "done", "failed", "degraded"]),
  errorCode: u().nullable(),
  errorMessage: u().nullable(),
  startedAt: ge().int(),
  finishedAt: ge().int().nullable()
});
le({
  id: u(),
  runId: u(),
  kind: u(),
  relPath: u(),
  sha256: u().length(64),
  bytes: ge().int().min(0),
  contentType: u(),
  createdAt: ge().int()
});
le({
  id: u(),
  runId: u(),
  modality: wn,
  sourceRef: u(),
  tStart: ge().min(0),
  tEnd: ge().min(0),
  quote: u().nullable(),
  nodeKey: u().nullable()
});
le({
  observationId: u(),
  runId: u(),
  fieldPath: u(),
  valueJson: u(),
  propositionKey: u().nullable(),
  retractsObservationId: u().nullable(),
  createdAt: ge().int()
});
le({
  observationId: u(),
  evidenceCoverage: Pe(["none", "single", "multiple"]),
  evidenceModalities: ge().int().min(0).max(2),
  evidenceQuality: Pe(["verbatim", "ocr_uncertain", "inferred"]),
  consistency: Pe(["agree", "conflict", "retracted"]),
  mappingStatus: Pe(["matched", "provisional", "unmapped"]),
  /** Queue order only. Higher means "a human should look sooner". Never shown as a percentage. */
  reviewPriority: ge().int(),
  priorityVersion: ge().int().min(1)
});
le({
  id: u(),
  observationId: u(),
  decision: Pe(["approved", "rejected", "reopened"]),
  actor: u(),
  note: u().nullable(),
  schemaRevisionId: u().nullable(),
  createdAt: ge().int()
});
le({
  runId: u(),
  sourceSha256: u().nullable(),
  schemaRevisionId: u().nullable(),
  schemaJson: u().nullable(),
  prompts: $t(u(), u()),
  asrEngine: u().nullable(),
  asrModel: u().nullable(),
  inferenceBackend: u().nullable(),
  inferenceModel: u().nullable(),
  backendVersion: u().nullable(),
  dependencyVersions: $t(u(), u()),
  settings: $t(u(), Mr()),
  createdAt: ge().int()
});
const Tn = le({
  source: u().min(1),
  schemaJson: u().nullable(),
  backendId: u().nullable(),
  /** Which stored revision this run was asked with, when it came from one. */
  schemaRevisionId: u().nullable().optional()
}), Tr = le({ runId: u().min(1) }), Cn = le({ source: u().min(1) }), An = le({
  name: u(),
  kind: Pe(["text", "list", "number", "date"]),
  description: u().optional()
}), Sn = le({
  schemaId: u().optional(),
  name: u().min(1),
  description: u().optional(),
  fields: gn(An)
}), Cr = le({ schemaId: u().min(1) }), En = le({ what: Pe(["runs", "everything"]) }), In = le({ path: u().min(1) }), Fn = le({
  what: Pe(["whisper-model", "yt-dlp"]),
  /** Which speech model. Ignored for anything else. */
  model: u().optional()
}), Rn = le({ backendId: u().min(1).nullable() });
Pr("kind", [
  le({ kind: Ze("event"), event: _n }),
  le({ kind: Ze("done"), runId: u(), summary: Mr() }),
  le({
    kind: Ze("failed"),
    runId: u(),
    error: le({ code: u(), message: u() })
  })
]);
const be = {
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
  runArtifacts: "lirovo:run-artifacts",
  install: "lirovo:install",
  storage: "lirovo:storage",
  purge: "lirovo:purge",
  reveal: "lirovo:reveal",
  installProgress: "lirovo:install-progress",
  preferences: "lirovo:preferences",
  setDefaultBackend: "lirovo:set-default-backend",
  engineEvent: "lirovo:engine-event"
}, On = (r = process.env, e = null) => {
  const t = r.LIROVO_DATA_DIR ?? Me.join(Yr(), "Library", "Application Support", "Lirovo");
  return {
    data: t,
    runs: Me.join(t, "runs"),
    models: Me.join(t, "models"),
    bundledBin: e,
    dbFile: Me.join(t, "lirovo.db")
  };
}, Nn = 32;
(() => {
  const r = Nn, e = new Float64Array(r * r);
  for (let t = 0; t < r; t += 1)
    for (let n = 0; n < r; n += 1)
      e[t * r + n] = Math.cos((2 * n + 1) * t * Math.PI / (2 * r));
  return e;
})();
var Zn = { exports: {} };
(function(r) {
  function e(n) {
    var a = Math.floor, s = new Array(64), i = new Array(64), c = new Array(64), h = new Array(64), y, P, we, Ee, Fe = new Array(65535), at = new Array(65535), gt = new Array(64), Xe = new Array(64), Oe = [], Le = 0, Ne = 7, Be = new Array(64), ve = new Array(64), p = new Array(64), q = new Array(256), d = new Array(2048), E, I = [
      0,
      1,
      5,
      6,
      14,
      15,
      27,
      28,
      2,
      4,
      7,
      13,
      16,
      26,
      29,
      42,
      3,
      8,
      12,
      17,
      25,
      30,
      41,
      43,
      9,
      11,
      18,
      24,
      31,
      40,
      44,
      53,
      10,
      19,
      23,
      32,
      39,
      45,
      52,
      54,
      20,
      22,
      33,
      38,
      46,
      51,
      55,
      60,
      21,
      34,
      37,
      47,
      50,
      56,
      59,
      61,
      35,
      36,
      48,
      49,
      57,
      58,
      62,
      63
    ], H = [0, 0, 1, 5, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0], j = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], B = [0, 0, 2, 1, 3, 3, 2, 4, 3, 5, 5, 4, 4, 0, 0, 1, 125], w = [
      1,
      2,
      3,
      0,
      4,
      17,
      5,
      18,
      33,
      49,
      65,
      6,
      19,
      81,
      97,
      7,
      34,
      113,
      20,
      50,
      129,
      145,
      161,
      8,
      35,
      66,
      177,
      193,
      21,
      82,
      209,
      240,
      36,
      51,
      98,
      114,
      130,
      9,
      10,
      22,
      23,
      24,
      25,
      26,
      37,
      38,
      39,
      40,
      41,
      42,
      52,
      53,
      54,
      55,
      56,
      57,
      58,
      67,
      68,
      69,
      70,
      71,
      72,
      73,
      74,
      83,
      84,
      85,
      86,
      87,
      88,
      89,
      90,
      99,
      100,
      101,
      102,
      103,
      104,
      105,
      106,
      115,
      116,
      117,
      118,
      119,
      120,
      121,
      122,
      131,
      132,
      133,
      134,
      135,
      136,
      137,
      138,
      146,
      147,
      148,
      149,
      150,
      151,
      152,
      153,
      154,
      162,
      163,
      164,
      165,
      166,
      167,
      168,
      169,
      170,
      178,
      179,
      180,
      181,
      182,
      183,
      184,
      185,
      186,
      194,
      195,
      196,
      197,
      198,
      199,
      200,
      201,
      202,
      210,
      211,
      212,
      213,
      214,
      215,
      216,
      217,
      218,
      225,
      226,
      227,
      228,
      229,
      230,
      231,
      232,
      233,
      234,
      241,
      242,
      243,
      244,
      245,
      246,
      247,
      248,
      249,
      250
    ], oe = [0, 0, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0], pe = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], ye = [0, 0, 2, 1, 2, 4, 4, 3, 4, 7, 5, 4, 4, 0, 1, 2, 119], R = [
      0,
      1,
      2,
      3,
      17,
      4,
      5,
      33,
      49,
      6,
      18,
      65,
      81,
      7,
      97,
      113,
      19,
      34,
      50,
      129,
      8,
      20,
      66,
      145,
      161,
      177,
      193,
      9,
      35,
      51,
      82,
      240,
      21,
      98,
      114,
      209,
      10,
      22,
      36,
      52,
      225,
      37,
      241,
      23,
      24,
      25,
      26,
      38,
      39,
      40,
      41,
      42,
      53,
      54,
      55,
      56,
      57,
      58,
      67,
      68,
      69,
      70,
      71,
      72,
      73,
      74,
      83,
      84,
      85,
      86,
      87,
      88,
      89,
      90,
      99,
      100,
      101,
      102,
      103,
      104,
      105,
      106,
      115,
      116,
      117,
      118,
      119,
      120,
      121,
      122,
      130,
      131,
      132,
      133,
      134,
      135,
      136,
      137,
      138,
      146,
      147,
      148,
      149,
      150,
      151,
      152,
      153,
      154,
      162,
      163,
      164,
      165,
      166,
      167,
      168,
      169,
      170,
      178,
      179,
      180,
      181,
      182,
      183,
      184,
      185,
      186,
      194,
      195,
      196,
      197,
      198,
      199,
      200,
      201,
      202,
      210,
      211,
      212,
      213,
      214,
      215,
      216,
      217,
      218,
      226,
      227,
      228,
      229,
      230,
      231,
      232,
      233,
      234,
      242,
      243,
      244,
      245,
      246,
      247,
      248,
      249,
      250
    ];
    function X(o) {
      for (var A = [
        16,
        11,
        10,
        16,
        24,
        40,
        51,
        61,
        12,
        12,
        14,
        19,
        26,
        58,
        60,
        55,
        14,
        13,
        16,
        24,
        40,
        57,
        69,
        56,
        14,
        17,
        22,
        29,
        51,
        87,
        80,
        62,
        18,
        22,
        37,
        56,
        68,
        109,
        103,
        77,
        24,
        35,
        55,
        64,
        81,
        104,
        113,
        92,
        49,
        64,
        78,
        87,
        103,
        121,
        120,
        101,
        72,
        92,
        95,
        98,
        112,
        100,
        103,
        99
      ], S = 0; S < 64; S++) {
        var N = a((A[S] * o + 50) / 100);
        N < 1 ? N = 1 : N > 255 && (N = 255), s[I[S]] = N;
      }
      for (var W = [
        17,
        18,
        24,
        47,
        99,
        99,
        99,
        99,
        18,
        21,
        26,
        66,
        99,
        99,
        99,
        99,
        24,
        26,
        56,
        99,
        99,
        99,
        99,
        99,
        47,
        66,
        99,
        99,
        99,
        99,
        99,
        99,
        99,
        99,
        99,
        99,
        99,
        99,
        99,
        99,
        99,
        99,
        99,
        99,
        99,
        99,
        99,
        99,
        99,
        99,
        99,
        99,
        99,
        99,
        99,
        99,
        99,
        99,
        99,
        99,
        99,
        99,
        99,
        99
      ], de = 0; de < 64; de++) {
        var ee = a((W[de] * o + 50) / 100);
        ee < 1 ? ee = 1 : ee > 255 && (ee = 255), i[I[de]] = ee;
      }
      for (var g = [
        1,
        1.387039845,
        1.306562965,
        1.175875602,
        1,
        0.785694958,
        0.5411961,
        0.275899379
      ], T = 0, F = 0; F < 8; F++)
        for (var _ = 0; _ < 8; _++)
          c[T] = 1 / (s[I[T]] * g[F] * g[_] * 8), h[T] = 1 / (i[I[T]] * g[F] * g[_] * 8), T++;
    }
    function $(o, A) {
      for (var S = 0, N = 0, W = new Array(), de = 1; de <= 16; de++) {
        for (var ee = 1; ee <= o[de]; ee++)
          W[A[N]] = [], W[A[N]][0] = S, W[A[N]][1] = de, N++, S++;
        S *= 2;
      }
      return W;
    }
    function ce() {
      y = $(H, j), P = $(oe, pe), we = $(B, w), Ee = $(ye, R);
    }
    function J() {
      for (var o = 1, A = 2, S = 1; S <= 15; S++) {
        for (var N = o; N < A; N++)
          at[32767 + N] = S, Fe[32767 + N] = [], Fe[32767 + N][1] = S, Fe[32767 + N][0] = N;
        for (var W = -(A - 1); W <= -o; W++)
          at[32767 + W] = S, Fe[32767 + W] = [], Fe[32767 + W][1] = S, Fe[32767 + W][0] = A - 1 + W;
        o <<= 1, A <<= 1;
      }
    }
    function G() {
      for (var o = 0; o < 256; o++)
        d[o] = 19595 * o, d[o + 256 >> 0] = 38470 * o, d[o + 512 >> 0] = 7471 * o + 32768, d[o + 768 >> 0] = -11059 * o, d[o + 1024 >> 0] = -21709 * o, d[o + 1280 >> 0] = 32768 * o + 8421375, d[o + 1536 >> 0] = -27439 * o, d[o + 1792 >> 0] = -5329 * o;
    }
    function C(o) {
      for (var A = o[0], S = o[1] - 1; S >= 0; )
        A & 1 << S && (Le |= 1 << Ne), S--, Ne--, Ne < 0 && (Le == 255 ? (v(255), v(0)) : v(Le), Ne = 7, Le = 0);
    }
    function v(o) {
      Oe.push(o);
    }
    function O(o) {
      v(o >> 8 & 255), v(o & 255);
    }
    function te(o, A) {
      var S, N, W, de, ee, g, T, F, _ = 0, D, ae = 8, L = 64;
      for (D = 0; D < ae; ++D) {
        S = o[_], N = o[_ + 1], W = o[_ + 2], de = o[_ + 3], ee = o[_ + 4], g = o[_ + 5], T = o[_ + 6], F = o[_ + 7];
        var se = S + F, ie = S - F, xe = N + T, Ae = N - T, _e = W + g, je = W - g, yt = de + ee, Zt = de - ee, ze = se + yt, st = se - yt, it = xe + _e, Ke = xe - _e;
        o[_] = ze + it, o[_ + 4] = ze - it;
        var lt = (Ke + st) * 0.707106781;
        o[_ + 2] = st + lt, o[_ + 6] = st - lt, ze = Zt + je, it = je + Ae, Ke = Ae + ie;
        var ut = (ze - Ke) * 0.382683433, ft = 0.5411961 * ze + ut, Jt = 1.306562965 * Ke + ut, Gt = it * 0.707106781, Qt = ie + Gt, Kt = ie - Gt;
        o[_ + 5] = Kt + ft, o[_ + 3] = Kt - ft, o[_ + 1] = Qt + Jt, o[_ + 7] = Qt - Jt, _ += 8;
      }
      for (_ = 0, D = 0; D < ae; ++D) {
        S = o[_], N = o[_ + 8], W = o[_ + 16], de = o[_ + 24], ee = o[_ + 32], g = o[_ + 40], T = o[_ + 48], F = o[_ + 56];
        var er = S + F, Mt = S - F, tr = N + T, rr = N - T, nr = W + g, ar = W - g, sr = de + ee, $r = de - ee, ht = er + sr, Pt = er - sr, _t = tr + nr, bt = tr - nr;
        o[_] = ht + _t, o[_ + 32] = ht - _t;
        var ir = (bt + Pt) * 0.707106781;
        o[_ + 16] = Pt + ir, o[_ + 48] = Pt - ir, ht = $r + ar, _t = ar + rr, bt = rr + Mt;
        var or = (ht - bt) * 0.382683433, cr = 0.5411961 * ht + or, dr = 1.306562965 * bt + or, lr = _t * 0.707106781, ur = Mt + lr, fr = Mt - lr;
        o[_ + 40] = fr + cr, o[_ + 24] = fr - cr, o[_ + 8] = ur + dr, o[_ + 56] = ur - dr, _++;
      }
      var kt;
      for (D = 0; D < L; ++D)
        kt = o[D] * A[D], gt[D] = kt > 0 ? kt + 0.5 | 0 : kt - 0.5 | 0;
      return gt;
    }
    function he() {
      O(65504), O(16), v(74), v(70), v(73), v(70), v(0), v(1), v(1), v(0), O(1), O(1), v(0), v(0);
    }
    function z(o) {
      if (o) {
        O(65505), o[0] === 69 && o[1] === 120 && o[2] === 105 && o[3] === 102 ? O(o.length + 2) : (O(o.length + 5 + 2), v(69), v(120), v(105), v(102), v(0));
        for (var A = 0; A < o.length; A++)
          v(o[A]);
      }
    }
    function fe(o, A) {
      O(65472), O(17), v(8), O(A), O(o), v(3), v(1), v(17), v(0), v(2), v(17), v(1), v(3), v(17), v(1);
    }
    function re() {
      O(65499), O(132), v(0);
      for (var o = 0; o < 64; o++)
        v(s[o]);
      v(1);
      for (var A = 0; A < 64; A++)
        v(i[A]);
    }
    function me() {
      O(65476), O(418), v(0);
      for (var o = 0; o < 16; o++)
        v(H[o + 1]);
      for (var A = 0; A <= 11; A++)
        v(j[A]);
      v(16);
      for (var S = 0; S < 16; S++)
        v(B[S + 1]);
      for (var N = 0; N <= 161; N++)
        v(w[N]);
      v(1);
      for (var W = 0; W < 16; W++)
        v(oe[W + 1]);
      for (var de = 0; de <= 11; de++)
        v(pe[de]);
      v(17);
      for (var ee = 0; ee < 16; ee++)
        v(ye[ee + 1]);
      for (var g = 0; g <= 161; g++)
        v(R[g]);
    }
    function Q(o) {
      typeof o > "u" || o.constructor !== Array || o.forEach((A) => {
        if (typeof A == "string") {
          O(65534);
          var S = A.length;
          O(S + 2);
          var N;
          for (N = 0; N < S; N++)
            v(A.charCodeAt(N));
        }
      });
    }
    function b() {
      O(65498), O(12), v(3), v(1), v(0), v(2), v(17), v(3), v(17), v(0), v(63), v(0);
    }
    function f(o, A, S, N, W) {
      for (var de = W[0], ee = W[240], g, T = 16, F = 63, _ = 64, D = te(o, A), ae = 0; ae < _; ++ae)
        Xe[I[ae]] = D[ae];
      var L = Xe[0] - S;
      S = Xe[0], L == 0 ? C(N[0]) : (g = 32767 + L, C(N[at[g]]), C(Fe[g]));
      for (var se = 63; se > 0 && Xe[se] == 0; se--)
        ;
      if (se == 0)
        return C(de), S;
      for (var ie = 1, xe; ie <= se; ) {
        for (var Ae = ie; Xe[ie] == 0 && ie <= se; ++ie)
          ;
        var _e = ie - Ae;
        if (_e >= T) {
          xe = _e >> 4;
          for (var je = 1; je <= xe; ++je)
            C(ee);
          _e = _e & 15;
        }
        g = 32767 + Xe[ie], C(W[(_e << 4) + at[g]]), C(Fe[g]), ie++;
      }
      return se != F && C(de), S;
    }
    function ne() {
      for (var o = String.fromCharCode, A = 0; A < 256; A++)
        q[A] = o(A);
    }
    this.encode = function(o, A) {
      (/* @__PURE__ */ new Date()).getTime(), A && V(A), Oe = new Array(), Le = 0, Ne = 7, O(65496), he(), Q(o.comments), z(o.exifBuffer), re(), fe(o.width, o.height), me(), b();
      var S = 0, N = 0, W = 0;
      Le = 0, Ne = 7, this.encode.displayName = "_encode_";
      for (var de = o.data, ee = o.width, g = o.height, T = ee * 4, F, _ = 0, D, ae, L, se, ie, xe, Ae, _e; _ < g; ) {
        for (F = 0; F < T; ) {
          for (se = T * _ + F, ie = se, xe = -1, Ae = 0, _e = 0; _e < 64; _e++)
            Ae = _e >> 3, xe = (_e & 7) * 4, ie = se + Ae * T + xe, _ + Ae >= g && (ie -= T * (_ + 1 + Ae - g)), F + xe >= T && (ie -= F + xe - T + 4), D = de[ie++], ae = de[ie++], L = de[ie++], Be[_e] = (d[D] + d[ae + 256 >> 0] + d[L + 512 >> 0] >> 16) - 128, ve[_e] = (d[D + 768 >> 0] + d[ae + 1024 >> 0] + d[L + 1280 >> 0] >> 16) - 128, p[_e] = (d[D + 1280 >> 0] + d[ae + 1536 >> 0] + d[L + 1792 >> 0] >> 16) - 128;
          S = f(Be, c, S, y, we), N = f(ve, h, N, P, Ee), W = f(p, h, W, P, Ee), F += 32;
        }
        _ += 8;
      }
      if (Ne >= 0) {
        var je = [];
        je[1] = Ne + 1, je[0] = (1 << Ne + 1) - 1, C(je);
      }
      return O(65497), Buffer.from(Oe);
    };
    function V(o) {
      if (o <= 0 && (o = 1), o > 100 && (o = 100), E != o) {
        var A = 0;
        o < 50 ? A = Math.floor(5e3 / o) : A = Math.floor(200 - o * 2), X(A), E = o;
      }
    }
    function U() {
      var o = (/* @__PURE__ */ new Date()).getTime();
      n || (n = 50), ne(), ce(), J(), G(), V(n), (/* @__PURE__ */ new Date()).getTime() - o;
    }
    U();
  }
  r.exports = t;
  function t(n, a) {
    typeof a > "u" && (a = 50);
    var s = new e(a), i = s.encode(n, a);
    return {
      data: i,
      width: n.width,
      height: n.height
    };
  }
})(Zn);
var Mn = { exports: {} };
(function(r) {
  var e = function() {
    var a = new Int32Array([
      0,
      1,
      8,
      16,
      9,
      2,
      3,
      10,
      17,
      24,
      32,
      25,
      18,
      11,
      4,
      5,
      12,
      19,
      26,
      33,
      40,
      48,
      41,
      34,
      27,
      20,
      13,
      6,
      7,
      14,
      21,
      28,
      35,
      42,
      49,
      56,
      57,
      50,
      43,
      36,
      29,
      22,
      15,
      23,
      30,
      37,
      44,
      51,
      58,
      59,
      52,
      45,
      38,
      31,
      39,
      46,
      53,
      60,
      61,
      54,
      47,
      55,
      62,
      63
    ]), s = 4017, i = 799, c = 3406, h = 2276, y = 1567, P = 3784, we = 5793, Ee = 2896;
    function Fe() {
    }
    function at(ve, p) {
      for (var q = 0, d = [], E, I, H = 16; H > 0 && !ve[H - 1]; )
        H--;
      d.push({ children: [], index: 0 });
      var j = d[0], B;
      for (E = 0; E < H; E++) {
        for (I = 0; I < ve[E]; I++) {
          for (j = d.pop(), j.children[j.index] = p[q]; j.index > 0; ) {
            if (d.length === 0)
              throw new Error("Could not recreate Huffman Table");
            j = d.pop();
          }
          for (j.index++, d.push(j); d.length <= E; )
            d.push(B = { children: [], index: 0 }), j.children[j.index] = B.children, j = B;
          q++;
        }
        E + 1 < H && (d.push(B = { children: [], index: 0 }), j.children[j.index] = B.children, j = B);
      }
      return d[0].children;
    }
    function gt(ve, p, q, d, E, I, H, j, B, w) {
      q.precision, q.samplesPerLine, q.scanLines;
      var oe = q.mcusPerLine, pe = q.progressive;
      q.maxH, q.maxV;
      var ye = p, R = 0, X = 0;
      function $() {
        if (X > 0)
          return X--, R >> X & 1;
        if (R = ve[p++], R == 255) {
          var g = ve[p++];
          if (g)
            throw new Error("unexpected marker: " + (R << 8 | g).toString(16));
        }
        return X = 7, R >>> 7;
      }
      function ce(g) {
        for (var T = g, F; (F = $()) !== null; ) {
          if (T = T[F], typeof T == "number")
            return T;
          if (typeof T != "object")
            throw new Error("invalid huffman sequence");
        }
        return null;
      }
      function J(g) {
        for (var T = 0; g > 0; ) {
          var F = $();
          if (F === null) return;
          T = T << 1 | F, g--;
        }
        return T;
      }
      function G(g) {
        var T = J(g);
        return T >= 1 << g - 1 ? T : T + (-1 << g) + 1;
      }
      function C(g, T) {
        var F = ce(g.huffmanTableDC), _ = F === 0 ? 0 : G(F);
        T[0] = g.pred += _;
        for (var D = 1; D < 64; ) {
          var ae = ce(g.huffmanTableAC), L = ae & 15, se = ae >> 4;
          if (L === 0) {
            if (se < 15)
              break;
            D += 16;
            continue;
          }
          D += se;
          var ie = a[D];
          T[ie] = G(L), D++;
        }
      }
      function v(g, T) {
        var F = ce(g.huffmanTableDC), _ = F === 0 ? 0 : G(F) << B;
        T[0] = g.pred += _;
      }
      function O(g, T) {
        T[0] |= $() << B;
      }
      var te = 0;
      function he(g, T) {
        if (te > 0) {
          te--;
          return;
        }
        for (var F = I, _ = H; F <= _; ) {
          var D = ce(g.huffmanTableAC), ae = D & 15, L = D >> 4;
          if (ae === 0) {
            if (L < 15) {
              te = J(L) + (1 << L) - 1;
              break;
            }
            F += 16;
            continue;
          }
          F += L;
          var se = a[F];
          T[se] = G(ae) * (1 << B), F++;
        }
      }
      var z = 0, fe;
      function re(g, T) {
        for (var F = I, _ = H, D = 0; F <= _; ) {
          var ae = a[F], L = T[ae] < 0 ? -1 : 1;
          switch (z) {
            case 0:
              var se = ce(g.huffmanTableAC), ie = se & 15, D = se >> 4;
              if (ie === 0)
                D < 15 ? (te = J(D) + (1 << D), z = 4) : (D = 16, z = 1);
              else {
                if (ie !== 1)
                  throw new Error("invalid ACn encoding");
                fe = G(ie), z = D ? 2 : 3;
              }
              continue;
            case 1:
            case 2:
              T[ae] ? T[ae] += ($() << B) * L : (D--, D === 0 && (z = z == 2 ? 3 : 0));
              break;
            case 3:
              T[ae] ? T[ae] += ($() << B) * L : (T[ae] = fe << B, z = 0);
              break;
            case 4:
              T[ae] && (T[ae] += ($() << B) * L);
              break;
          }
          F++;
        }
        z === 4 && (te--, te === 0 && (z = 0));
      }
      function me(g, T, F, _, D) {
        var ae = F / oe | 0, L = F % oe, se = ae * g.v + _, ie = L * g.h + D;
        g.blocks[se] === void 0 && w.tolerantDecoding || T(g, g.blocks[se][ie]);
      }
      function Q(g, T, F) {
        var _ = F / g.blocksPerLine | 0, D = F % g.blocksPerLine;
        g.blocks[_] === void 0 && w.tolerantDecoding || T(g, g.blocks[_][D]);
      }
      var b = d.length, f, ne, V, U, o, A;
      pe ? I === 0 ? A = j === 0 ? v : O : A = j === 0 ? he : re : A = C;
      var S = 0, N, W;
      b == 1 ? W = d[0].blocksPerLine * d[0].blocksPerColumn : W = oe * q.mcusPerColumn, E || (E = W);
      for (var de, ee; S < W; ) {
        for (ne = 0; ne < b; ne++)
          d[ne].pred = 0;
        if (te = 0, b == 1)
          for (f = d[0], o = 0; o < E; o++)
            Q(f, A, S), S++;
        else
          for (o = 0; o < E; o++) {
            for (ne = 0; ne < b; ne++)
              for (f = d[ne], de = f.h, ee = f.v, V = 0; V < ee; V++)
                for (U = 0; U < de; U++)
                  me(f, A, S, V, U);
            if (S++, S === W) break;
          }
        if (S === W)
          do {
            if (ve[p] === 255 && ve[p + 1] !== 0)
              break;
            p += 1;
          } while (p < ve.length - 2);
        if (X = 0, N = ve[p] << 8 | ve[p + 1], N < 65280)
          throw new Error("marker was not found");
        if (N >= 65488 && N <= 65495)
          p += 2;
        else
          break;
      }
      return p - ye;
    }
    function Xe(ve, p) {
      var q = [], d = p.blocksPerLine, E = p.blocksPerColumn, I = d << 3, H = new Int32Array(64), j = new Uint8Array(64);
      function B(J, G, C) {
        var v = p.quantizationTable, O, te, he, z, fe, re, me, Q, b, f = C, ne;
        for (ne = 0; ne < 64; ne++)
          f[ne] = J[ne] * v[ne];
        for (ne = 0; ne < 8; ++ne) {
          var V = 8 * ne;
          if (f[1 + V] == 0 && f[2 + V] == 0 && f[3 + V] == 0 && f[4 + V] == 0 && f[5 + V] == 0 && f[6 + V] == 0 && f[7 + V] == 0) {
            b = we * f[0 + V] + 512 >> 10, f[0 + V] = b, f[1 + V] = b, f[2 + V] = b, f[3 + V] = b, f[4 + V] = b, f[5 + V] = b, f[6 + V] = b, f[7 + V] = b;
            continue;
          }
          O = we * f[0 + V] + 128 >> 8, te = we * f[4 + V] + 128 >> 8, he = f[2 + V], z = f[6 + V], fe = Ee * (f[1 + V] - f[7 + V]) + 128 >> 8, Q = Ee * (f[1 + V] + f[7 + V]) + 128 >> 8, re = f[3 + V] << 4, me = f[5 + V] << 4, b = O - te + 1 >> 1, O = O + te + 1 >> 1, te = b, b = he * P + z * y + 128 >> 8, he = he * y - z * P + 128 >> 8, z = b, b = fe - me + 1 >> 1, fe = fe + me + 1 >> 1, me = b, b = Q + re + 1 >> 1, re = Q - re + 1 >> 1, Q = b, b = O - z + 1 >> 1, O = O + z + 1 >> 1, z = b, b = te - he + 1 >> 1, te = te + he + 1 >> 1, he = b, b = fe * h + Q * c + 2048 >> 12, fe = fe * c - Q * h + 2048 >> 12, Q = b, b = re * i + me * s + 2048 >> 12, re = re * s - me * i + 2048 >> 12, me = b, f[0 + V] = O + Q, f[7 + V] = O - Q, f[1 + V] = te + me, f[6 + V] = te - me, f[2 + V] = he + re, f[5 + V] = he - re, f[3 + V] = z + fe, f[4 + V] = z - fe;
        }
        for (ne = 0; ne < 8; ++ne) {
          var U = ne;
          if (f[8 + U] == 0 && f[16 + U] == 0 && f[24 + U] == 0 && f[32 + U] == 0 && f[40 + U] == 0 && f[48 + U] == 0 && f[56 + U] == 0) {
            b = we * C[ne + 0] + 8192 >> 14, f[0 + U] = b, f[8 + U] = b, f[16 + U] = b, f[24 + U] = b, f[32 + U] = b, f[40 + U] = b, f[48 + U] = b, f[56 + U] = b;
            continue;
          }
          O = we * f[0 + U] + 2048 >> 12, te = we * f[32 + U] + 2048 >> 12, he = f[16 + U], z = f[48 + U], fe = Ee * (f[8 + U] - f[56 + U]) + 2048 >> 12, Q = Ee * (f[8 + U] + f[56 + U]) + 2048 >> 12, re = f[24 + U], me = f[40 + U], b = O - te + 1 >> 1, O = O + te + 1 >> 1, te = b, b = he * P + z * y + 2048 >> 12, he = he * y - z * P + 2048 >> 12, z = b, b = fe - me + 1 >> 1, fe = fe + me + 1 >> 1, me = b, b = Q + re + 1 >> 1, re = Q - re + 1 >> 1, Q = b, b = O - z + 1 >> 1, O = O + z + 1 >> 1, z = b, b = te - he + 1 >> 1, te = te + he + 1 >> 1, he = b, b = fe * h + Q * c + 2048 >> 12, fe = fe * c - Q * h + 2048 >> 12, Q = b, b = re * i + me * s + 2048 >> 12, re = re * s - me * i + 2048 >> 12, me = b, f[0 + U] = O + Q, f[56 + U] = O - Q, f[8 + U] = te + me, f[48 + U] = te - me, f[16 + U] = he + re, f[40 + U] = he - re, f[24 + U] = z + fe, f[32 + U] = z - fe;
        }
        for (ne = 0; ne < 64; ++ne) {
          var o = 128 + (f[ne] + 8 >> 4);
          G[ne] = o < 0 ? 0 : o > 255 ? 255 : o;
        }
      }
      Be(I * E * 8);
      for (var w, oe, pe = 0; pe < E; pe++) {
        var ye = pe << 3;
        for (w = 0; w < 8; w++)
          q.push(new Uint8Array(I));
        for (var R = 0; R < d; R++) {
          B(p.blocks[pe][R], j, H);
          var X = 0, $ = R << 3;
          for (oe = 0; oe < 8; oe++) {
            var ce = q[ye + oe];
            for (w = 0; w < 8; w++)
              ce[$ + w] = j[X++];
          }
        }
      }
      return q;
    }
    function Oe(ve) {
      return ve < 0 ? 0 : ve > 255 ? 255 : ve;
    }
    Fe.prototype = {
      load: function(p) {
        var q = new XMLHttpRequest();
        q.open("GET", p, !0), q.responseType = "arraybuffer", q.onload = (function() {
          var d = new Uint8Array(q.response || q.mozResponseArrayBuffer);
          this.parse(d), this.onload && this.onload();
        }).bind(this), q.send(null);
      },
      parse: function(p) {
        var q = this.opts.maxResolutionInMP * 1e3 * 1e3, d = 0;
        p.length;
        function E() {
          var L = p[d] << 8 | p[d + 1];
          return d += 2, L;
        }
        function I() {
          var L = E(), se = p.subarray(d, d + L - 2);
          return d += se.length, se;
        }
        function H(L) {
          var se = 1, ie = 1, xe, Ae;
          for (Ae in L.components)
            L.components.hasOwnProperty(Ae) && (xe = L.components[Ae], se < xe.h && (se = xe.h), ie < xe.v && (ie = xe.v));
          var _e = Math.ceil(L.samplesPerLine / 8 / se), je = Math.ceil(L.scanLines / 8 / ie);
          for (Ae in L.components)
            if (L.components.hasOwnProperty(Ae)) {
              xe = L.components[Ae];
              var yt = Math.ceil(Math.ceil(L.samplesPerLine / 8) * xe.h / se), Zt = Math.ceil(Math.ceil(L.scanLines / 8) * xe.v / ie), ze = _e * xe.h, st = je * xe.v, it = st * ze, Ke = [];
              Be(it * 256);
              for (var lt = 0; lt < st; lt++) {
                for (var ut = [], ft = 0; ft < ze; ft++)
                  ut.push(new Int32Array(64));
                Ke.push(ut);
              }
              xe.blocksPerLine = yt, xe.blocksPerColumn = Zt, xe.blocks = Ke;
            }
          L.maxH = se, L.maxV = ie, L.mcusPerLine = _e, L.mcusPerColumn = je;
        }
        var j = null, B = null, w, oe, pe = [], ye = [], R = [], X = [], $ = E(), ce = -1;
        if (this.comments = [], $ != 65496)
          throw new Error("SOI not found");
        for ($ = E(); $ != 65497; ) {
          var J, G;
          switch ($) {
            case 65280:
              break;
            case 65504:
            case 65505:
            case 65506:
            case 65507:
            case 65508:
            case 65509:
            case 65510:
            case 65511:
            case 65512:
            case 65513:
            case 65514:
            case 65515:
            case 65516:
            case 65517:
            case 65518:
            case 65519:
            case 65534:
              var C = I();
              if ($ === 65534) {
                var v = String.fromCharCode.apply(null, C);
                this.comments.push(v);
              }
              $ === 65504 && C[0] === 74 && C[1] === 70 && C[2] === 73 && C[3] === 70 && C[4] === 0 && (j = {
                version: { major: C[5], minor: C[6] },
                densityUnits: C[7],
                xDensity: C[8] << 8 | C[9],
                yDensity: C[10] << 8 | C[11],
                thumbWidth: C[12],
                thumbHeight: C[13],
                thumbData: C.subarray(14, 14 + 3 * C[12] * C[13])
              }), $ === 65505 && C[0] === 69 && C[1] === 120 && C[2] === 105 && C[3] === 102 && C[4] === 0 && (this.exifBuffer = C.subarray(5, C.length)), $ === 65518 && C[0] === 65 && C[1] === 100 && C[2] === 111 && C[3] === 98 && C[4] === 101 && C[5] === 0 && (B = {
                version: C[6],
                flags0: C[7] << 8 | C[8],
                flags1: C[9] << 8 | C[10],
                transformCode: C[11]
              });
              break;
            case 65499:
              for (var O = E(), te = O + d - 2; d < te; ) {
                var he = p[d++];
                Be(256);
                var z = new Int32Array(64);
                if (he >> 4)
                  if (he >> 4 === 1)
                    for (G = 0; G < 64; G++) {
                      var fe = a[G];
                      z[fe] = E();
                    }
                  else
                    throw new Error("DQT: invalid table spec");
                else for (G = 0; G < 64; G++) {
                  var fe = a[G];
                  z[fe] = p[d++];
                }
                pe[he & 15] = z;
              }
              break;
            case 65472:
            case 65473:
            case 65474:
              E(), w = {}, w.extended = $ === 65473, w.progressive = $ === 65474, w.precision = p[d++], w.scanLines = E(), w.samplesPerLine = E(), w.components = {}, w.componentsOrder = [];
              var re = w.scanLines * w.samplesPerLine;
              if (re > q) {
                var me = Math.ceil((re - q) / 1e6);
                throw new Error(`maxResolutionInMP limit exceeded by ${me}MP`);
              }
              var Q = p[d++], b;
              for (J = 0; J < Q; J++) {
                b = p[d];
                var f = p[d + 1] >> 4, ne = p[d + 1] & 15, V = p[d + 2];
                if (f <= 0 || ne <= 0)
                  throw new Error("Invalid sampling factor, expected values above 0");
                w.componentsOrder.push(b), w.components[b] = {
                  h: f,
                  v: ne,
                  quantizationIdx: V
                }, d += 3;
              }
              H(w), ye.push(w);
              break;
            case 65476:
              var U = E();
              for (J = 2; J < U; ) {
                var o = p[d++], A = new Uint8Array(16), S = 0;
                for (G = 0; G < 16; G++, d++)
                  S += A[G] = p[d];
                Be(16 + S);
                var N = new Uint8Array(S);
                for (G = 0; G < S; G++, d++)
                  N[G] = p[d];
                J += 17 + S, (o >> 4 ? R : X)[o & 15] = at(A, N);
              }
              break;
            case 65501:
              E(), oe = E();
              break;
            case 65500:
              E(), E();
              break;
            case 65498:
              E();
              var W = p[d++], de = [], ee;
              for (J = 0; J < W; J++) {
                ee = w.components[p[d++]];
                var g = p[d++];
                ee.huffmanTableDC = X[g >> 4], ee.huffmanTableAC = R[g & 15], de.push(ee);
              }
              var T = p[d++], F = p[d++], _ = p[d++], D = gt(
                p,
                d,
                w,
                de,
                oe,
                T,
                F,
                _ >> 4,
                _ & 15,
                this.opts
              );
              d += D;
              break;
            case 65535:
              p[d] !== 255 && d--;
              break;
            default:
              if (p[d - 3] == 255 && p[d - 2] >= 192 && p[d - 2] <= 254) {
                d -= 3;
                break;
              } else if ($ === 224 || $ == 225) {
                if (ce !== -1)
                  throw new Error(`first unknown JPEG marker at offset ${ce.toString(16)}, second unknown JPEG marker ${$.toString(16)} at offset ${(d - 1).toString(16)}`);
                ce = d - 1;
                const L = E();
                if (p[d + L - 2] === 255) {
                  d += L - 2;
                  break;
                }
              }
              throw new Error("unknown JPEG marker " + $.toString(16));
          }
          $ = E();
        }
        if (ye.length != 1)
          throw new Error("only single frame JPEGs supported");
        for (var J = 0; J < ye.length; J++) {
          var ae = ye[J].components;
          for (var G in ae)
            ae[G].quantizationTable = pe[ae[G].quantizationIdx], delete ae[G].quantizationIdx;
        }
        this.width = w.samplesPerLine, this.height = w.scanLines, this.jfif = j, this.adobe = B, this.components = [];
        for (var J = 0; J < w.componentsOrder.length; J++) {
          var ee = w.components[w.componentsOrder[J]];
          this.components.push({
            lines: Xe(w, ee),
            scaleX: ee.h / w.maxH,
            scaleY: ee.v / w.maxV
          });
        }
      },
      getData: function(p, q) {
        var d = this.width / p, E = this.height / q, I, H, j, B, w, oe, pe, ye, R, X, $ = 0, ce, J, G, C, v, O, te, he, z, fe, re, me = p * q * this.components.length;
        Be(me);
        var Q = new Uint8Array(me);
        switch (this.components.length) {
          case 1:
            for (I = this.components[0], X = 0; X < q; X++)
              for (w = I.lines[0 | X * I.scaleY * E], R = 0; R < p; R++)
                ce = w[0 | R * I.scaleX * d], Q[$++] = ce;
            break;
          case 2:
            for (I = this.components[0], H = this.components[1], X = 0; X < q; X++)
              for (w = I.lines[0 | X * I.scaleY * E], oe = H.lines[0 | X * H.scaleY * E], R = 0; R < p; R++)
                ce = w[0 | R * I.scaleX * d], Q[$++] = ce, ce = oe[0 | R * H.scaleX * d], Q[$++] = ce;
            break;
          case 3:
            for (re = !0, this.adobe && this.adobe.transformCode ? re = !0 : typeof this.opts.colorTransform < "u" && (re = !!this.opts.colorTransform), I = this.components[0], H = this.components[1], j = this.components[2], X = 0; X < q; X++)
              for (w = I.lines[0 | X * I.scaleY * E], oe = H.lines[0 | X * H.scaleY * E], pe = j.lines[0 | X * j.scaleY * E], R = 0; R < p; R++)
                re ? (ce = w[0 | R * I.scaleX * d], J = oe[0 | R * H.scaleX * d], G = pe[0 | R * j.scaleX * d], he = Oe(ce + 1.402 * (G - 128)), z = Oe(ce - 0.3441363 * (J - 128) - 0.71413636 * (G - 128)), fe = Oe(ce + 1.772 * (J - 128))) : (he = w[0 | R * I.scaleX * d], z = oe[0 | R * H.scaleX * d], fe = pe[0 | R * j.scaleX * d]), Q[$++] = he, Q[$++] = z, Q[$++] = fe;
            break;
          case 4:
            if (!this.adobe)
              throw new Error("Unsupported color mode (4 components)");
            for (re = !1, this.adobe && this.adobe.transformCode ? re = !0 : typeof this.opts.colorTransform < "u" && (re = !!this.opts.colorTransform), I = this.components[0], H = this.components[1], j = this.components[2], B = this.components[3], X = 0; X < q; X++)
              for (w = I.lines[0 | X * I.scaleY * E], oe = H.lines[0 | X * H.scaleY * E], pe = j.lines[0 | X * j.scaleY * E], ye = B.lines[0 | X * B.scaleY * E], R = 0; R < p; R++)
                re ? (ce = w[0 | R * I.scaleX * d], J = oe[0 | R * H.scaleX * d], G = pe[0 | R * j.scaleX * d], C = ye[0 | R * B.scaleX * d], v = 255 - Oe(ce + 1.402 * (G - 128)), O = 255 - Oe(ce - 0.3441363 * (J - 128) - 0.71413636 * (G - 128)), te = 255 - Oe(ce + 1.772 * (J - 128))) : (v = w[0 | R * I.scaleX * d], O = oe[0 | R * H.scaleX * d], te = pe[0 | R * j.scaleX * d], C = ye[0 | R * B.scaleX * d]), Q[$++] = 255 - v, Q[$++] = 255 - O, Q[$++] = 255 - te, Q[$++] = 255 - C;
            break;
          default:
            throw new Error("Unsupported color mode");
        }
        return Q;
      },
      copyToImageData: function(p, q) {
        var d = p.width, E = p.height, I = p.data, H = this.getData(d, E), j = 0, B = 0, w, oe, pe, ye, R, X, $, ce, J;
        switch (this.components.length) {
          case 1:
            for (oe = 0; oe < E; oe++)
              for (w = 0; w < d; w++)
                pe = H[j++], I[B++] = pe, I[B++] = pe, I[B++] = pe, q && (I[B++] = 255);
            break;
          case 3:
            for (oe = 0; oe < E; oe++)
              for (w = 0; w < d; w++)
                $ = H[j++], ce = H[j++], J = H[j++], I[B++] = $, I[B++] = ce, I[B++] = J, q && (I[B++] = 255);
            break;
          case 4:
            for (oe = 0; oe < E; oe++)
              for (w = 0; w < d; w++)
                R = H[j++], X = H[j++], pe = H[j++], ye = H[j++], $ = 255 - Oe(R * (1 - ye / 255) + ye), ce = 255 - Oe(X * (1 - ye / 255) + ye), J = 255 - Oe(pe * (1 - ye / 255) + ye), I[B++] = $, I[B++] = ce, I[B++] = J, q && (I[B++] = 255);
            break;
          default:
            throw new Error("Unsupported color mode");
        }
      }
    };
    var Le = 0, Ne = 0;
    function Be(ve = 0) {
      var p = Le + ve;
      if (p > Ne) {
        var q = Math.ceil((p - Ne) / 1024 / 1024);
        throw new Error(`maxMemoryUsageInMB limit exceeded by at least ${q}MB`);
      }
      Le = p;
    }
    return Fe.resetMaxMemoryUsage = function(ve) {
      Le = 0, Ne = ve;
    }, Fe.getBytesAllocated = function() {
      return Le;
    }, Fe.requestMemoryAllocation = Be, Fe;
  }();
  r.exports = t;
  function t(n, a = {}) {
    var s = {
      // "undefined" means "Choose whether to transform colors based on the image’s color model."
      colorTransform: void 0,
      useTArray: !1,
      formatAsRGBA: !0,
      tolerantDecoding: !0,
      maxResolutionInMP: 100,
      // Don't decode more than 100 megapixels
      maxMemoryUsageInMB: 512
      // Don't decode if memory footprint is more than 512MB
    }, i = { ...s, ...a }, c = new Uint8Array(n), h = new e();
    h.opts = i, e.resetMaxMemoryUsage(i.maxMemoryUsageInMB * 1024 * 1024), h.parse(c);
    var y = i.formatAsRGBA ? 4 : 3, P = h.width * h.height * y;
    try {
      e.requestMemoryAllocation(P);
      var we = {
        width: h.width,
        height: h.height,
        exifBuffer: h.exifBuffer,
        data: i.useTArray ? new Uint8Array(P) : Buffer.alloc(P)
      };
      h.comments.length > 0 && (we.comments = h.comments);
    } catch (Ee) {
      throw Ee instanceof RangeError ? new Error("Could not allocate enough memory for the image. Required: " + P) : Ee instanceof ReferenceError && Ee.message === "Buffer is not defined" ? new Error("Buffer is not globally defined in this environment. Consider setting useTArray to true") : Ee;
    }
    return h.copyToImageData(we, i.formatAsRGBA), we;
  }
})(Mn);
new AbortController().signal;
const jr = "lirovo-media", Pn = (r) => {
  const e = [];
  for (const t of r.split("/"))
    t === "" || t === "." || (t === ".." ? e.pop() : e.push(t));
  return `/${e.join("/")}`;
}, jn = (r) => Pn(decodeURIComponent(new URL(r).pathname)), $n = () => {
  Er.registerSchemesAsPrivileged([
    {
      scheme: jr,
      privileges: {
        // `stream: true` is what makes <video> able to seek: without it
        // Chromium has to buffer the whole file before it will scrub.
        stream: !0,
        supportFetchAPI: !0,
        bypassCSP: !1,
        standard: !0,
        secure: !0
      }
    }
  ]);
}, Ln = (r, e) => {
  const t = Me.relative(e, r);
  return t !== "" && !t.startsWith("..") && !Me.isAbsolute(t);
}, Vn = (r, e) => {
  const t = jn(r);
  if (!e.some((n) => Ln(t, n)))
    return process.stderr.write(`[media] refused ${t}
`), new Response("forbidden", { status: 403 });
  try {
    const n = Ur(t).size;
    return new Response(Wr.toWeb(Br(t)), {
      status: 200,
      headers: {
        "content-length": String(n),
        "content-type": Un(t),
        // Seeking works without this in Chromium's stream mode, but saying so
        // is what stops it from downloading the whole file to scrub.
        "accept-ranges": "bytes"
      }
    });
  } catch {
    return process.stderr.write(`[media] missing ${t}
`), new Response("not found", { status: 404 });
  }
}, Dn = {
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".flac": "audio/flac",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4"
}, Un = (r) => Dn[Me.extname(r).toLowerCase()] ?? "application/octet-stream", Bn = () => {
  const r = [On().runs];
  Er.handle(jr, (e) => Vn(e.url, r));
}, Ht = Me.dirname(Vr(import.meta.url));
$n();
const Ar = process.env.VITE_DEV_SERVER_URL;
let Re = null, Ge = null;
const vt = /* @__PURE__ */ new Map(), Wn = () => {
  const r = Dr.fork(Me.join(Ht, "engine-host.js"), [], { stdio: "inherit" });
  return r.on("message", (e) => {
    const t = e;
    if (t.kind === "event") {
      Re == null || Re.webContents.send(be.engineEvent, t.event);
      return;
    }
    if (t.kind === "install-progress") {
      Re == null || Re.webContents.send(be.installProgress, t.progress);
      return;
    }
    const n = vt.get(t.id);
    n !== void 0 && (vt.delete(t.id), t.kind === "result" ? n.resolve(t.value) : n.reject(Object.assign(new Error(t.error.message), { code: t.error.code })));
  }), r.on("exit", () => {
    for (const [, e] of vt)
      e.reject(new Error("the engine process stopped"));
    vt.clear(), Ge = null;
  }), r;
}, Se = (r) => {
  Ge ?? (Ge = Wn());
  const e = Lr();
  return new Promise((t, n) => {
    vt.set(e, { resolve: t, reject: n }), Ge == null || Ge.postMessage({ id: e, ...r });
  });
}, Yn = async (r) => {
  try {
    return { ok: !0, value: await r() };
  } catch (e) {
    return { ok: !1, error: { code: e.code ?? "INTERNAL", message: e instanceof Error ? e.message : String(e) } };
  }
}, Sr = () => {
  Re = new Ir({
    width: 1180,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#101012",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: Me.join(Ht, "../preload/index.js"),
      contextIsolation: !0,
      nodeIntegration: !1,
      sandbox: !1
    }
  }), Re.webContents.setWindowOpenHandler(({ url: r }) => (/^https?:\/\//i.test(r) && Fr.openExternal(r), { action: "deny" })), Re.webContents.on("will-navigate", (r) => r.preventDefault()), Ar !== void 0 ? Re.loadURL(Ar) : Re.loadFile(Me.join(Ht, "../../dist/index.html")), Re.on("closed", () => {
    Re = null;
  });
}, qn = (r) => r.senderFrame !== null && r.senderFrame.parent === null, Ce = (r) => async (e, t) => qn(e) ? Yn(() => r(t)) : { ok: !1, error: { code: "FORBIDDEN", message: "not the main frame" } };
wt.whenReady().then(() => {
  Bn(), Te.handle(be.doctor, Ce(() => Se({ type: "doctor" }))), Te.handle(be.listRuns, Ce(() => Se({ type: "listRuns" }))), Te.handle(
    be.runDetail,
    Ce((r) => Se({ type: "runDetail", runId: Tr.parse(r).runId }))
  ), Te.handle(
    be.extract,
    Ce((r) => Se({ type: "extract", request: Tn.parse(r) }))
  ), Te.handle(
    be.inspect,
    Ce((r) => Se({ type: "inspect", source: Cn.parse(r).source }))
  ), Te.handle(be.listSchemas, Ce(() => Se({ type: "listSchemas" }))), Te.handle(
    be.saveSchema,
    Ce((r) => Se({ type: "saveSchema", input: Sn.parse(r) }))
  ), Te.handle(
    be.schemaRevisions,
    Ce((r) => Se({ type: "schemaRevisions", schemaId: Cr.parse(r).schemaId }))
  ), Te.handle(
    be.archiveSchema,
    Ce((r) => Se({ type: "archiveSchema", schemaId: Cr.parse(r).schemaId }))
  ), Te.handle(
    be.runArtifacts,
    Ce((r) => Se({ type: "runArtifacts", runId: Tr.parse(r).runId }))
  ), Te.handle(
    be.install,
    Ce((r) => {
      const { what: e, model: t } = Fn.parse(r);
      return Se({ type: "install", what: e, ...t === void 0 ? {} : { model: t } });
    })
  ), Te.handle(be.storage, Ce(() => Se({ type: "storage" }))), Te.handle(
    be.purge,
    Ce(async (r) => {
      const { what: e } = En.parse(r), t = e === "everything", { response: n } = await hr.showMessageBox(Re, {
        type: "warning",
        buttons: ["Cancel", t ? "Delete everything" : "Delete extractions"],
        defaultId: 0,
        cancelId: 0,
        message: t ? "Delete everything Lirovo has stored?" : "Delete every extraction?",
        detail: t ? "The database, every extraction, the downloaded speech model and any binary this app installed. Schemas go too. This cannot be undone." : "Every run and its artifacts — frames, transcripts, graphs. Schemas, settings and the downloaded model are kept. This cannot be undone."
      });
      return n !== 1 ? { cancelled: !0, freedBytes: 0 } : { cancelled: !1, ...await Se({ type: "purge", what: e }) };
    })
  ), Te.handle(
    be.reveal,
    Ce(async (r) => {
      const { path: e } = In.parse(r), { resolvePaths: t } = await import("./index-jq7OEiWM.js"), n = t().data, a = Me.resolve(e);
      return a !== n && !a.startsWith(`${n}${Me.sep}`) ? { revealed: !1 } : (Fr.showItemInFolder(a), { revealed: !0 });
    })
  ), Te.handle(be.preferences, Ce(() => Se({ type: "preferences" }))), Te.handle(
    be.setDefaultBackend,
    Ce((r) => Se({ type: "setDefaultBackend", backendId: Rn.parse(r).backendId }))
  ), Te.handle(be.cancel, Ce(() => Se({ type: "cancel" }))), Te.handle(
    be.pickFile,
    Ce(async () => {
      const r = await hr.showOpenDialog({
        properties: ["openFile"],
        filters: [{ name: "Video or audio", extensions: ["mp4", "mov", "mkv", "webm", "m4a", "mp3", "wav", "flac"] }]
      });
      return r.canceled ? null : r.filePaths[0] ?? null;
    })
  ), Sr(), wt.on("activate", () => {
    Ir.getAllWindows().length === 0 && Sr();
  });
});
wt.on("window-all-closed", () => {
  Ge == null || Ge.kill(), process.platform !== "darwin" && wt.quit();
});
export {
  On as r
};
