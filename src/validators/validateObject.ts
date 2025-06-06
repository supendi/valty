import { ErrorOf, ErrorOfArray } from "../types/ErrorOf";
import { ArrayValidationRule, RuleViolation } from "../types/ValidationRule";
import { ValidateFunc } from "../types/ValidationRule";
import { ValidationRule } from "../types/ValidationRule";

export type PropertyType = "array" | "object" | "primitive" | "undefined"

type PrimitiveRule<T, TRoot> = ValidateFunc<T[Extract<keyof T, string>], TRoot>[]

export type Violations = RuleViolation[]

export type PrimitiveFieldValidationResult = {
    isValid: boolean
    errors: Violations
}

export type ObjectFieldValidationResult<T> = {
    isValid: boolean
    errors?: ErrorOf<T> | Violations
}

export function isArrayValidationRule<T, TRoot>(rule: ValidationRule<T, TRoot>[Extract<keyof T, string>] | ArrayValidationRule<T[Extract<keyof T, string>], TRoot>) {
    const allowedKeys = new Set(["arrayRules", "arrayElementRule"]);
    const keys = Object.keys(rule);

    const isArrayRule = keys.every(key => allowedKeys.has(key));
    return isArrayRule
}

export function validatePrimitiveField<T, TRoot>(key: Extract<keyof T, string>, object: T, root: TRoot, rule: PrimitiveRule<T, TRoot>): PrimitiveFieldValidationResult {
    var violations: Violations = [];
    for (let index = 0; index < rule.length; index++) {
        const validateFunc = rule[index];
        if (!validateFunc) {
            continue;
        }

        const isFunction = typeof (validateFunc) === "function";
        if (!isFunction) {
            throw Error("propertyRuleFunc is not a function")
        }

        const value = object[key];
        const violation = validateFunc(value, root);

        if (violation) {
            violations.push(violation);
        }
    }

    const validationResult: PrimitiveFieldValidationResult = {
        errors: violations,
        isValid: violations.length === 0
    };
    return validationResult
}

function validateArrayField<T, TRoot>(key: Extract<keyof T, string>, object: T, root: TRoot, rule: ValidationRule<T, TRoot>[Extract<keyof T, string>] | ArrayValidationRule<T[Extract<keyof T, string>], TRoot>) {

    const value = object[key];

    // Support dynamic rule builder function
    if (typeof rule === "function") {
        const arrayRule = rule(value, root)
        return validateArrayField(key, object, root, arrayRule) // Recurse into built rule
    }

    var arrayFieldErrors: ErrorOfArray<T> = {};

    const arrayValidationRule = rule as ArrayValidationRule<typeof value, TRoot>;

    if (arrayValidationRule.arrayRules) {
        for (let index = 0; index < arrayValidationRule.arrayRules.length; index++) {
            const primitiveFieldValidationResult = validatePrimitiveField(key, object, root, arrayValidationRule.arrayRules)
            if (!primitiveFieldValidationResult.isValid) {
                arrayFieldErrors.arrayErrors = primitiveFieldValidationResult.errors
            }
        }
    }

    if (arrayValidationRule.arrayElementRule && Array.isArray(value)) {
        for (let index = 0; index < value.length; index++) {
            const element = value[index];
            let error: ErrorOf<any> = undefined
            if (typeof arrayValidationRule.arrayElementRule === "function") {
                const validationRule = arrayValidationRule.arrayElementRule(element, root)
                error = validateObject(element, root, validationRule);
            }
            else {
                error = validateObject(element, root, arrayValidationRule.arrayElementRule);
            }
            if (error) {
                if (!arrayFieldErrors.arrayElementErrors) {
                    arrayFieldErrors.arrayElementErrors = []
                }

                arrayFieldErrors.arrayElementErrors.push({
                    index: index,
                    errors: error,
                    attemptedValue: element
                });
            }
            continue;
        }
    }

    return arrayFieldErrors
}


function validateObjectField<T, TRoot>(key: Extract<keyof T, string>, object: T, root: TRoot, rule: ValidationRule<T, TRoot>[Extract<keyof T, string>]): ObjectFieldValidationResult<T[Extract<keyof T, string>]> {
    var violations: Violations = [];
    const value = object[key];

    const childValidationRule = rule as ValidationRule<typeof value, TRoot>;
    const error = validateObject(value, root, childValidationRule);
    const validationResult: ObjectFieldValidationResult<T[Extract<keyof T, string>]> = {
        errors: error,
        isValid: violations.length === 0 && !error
    };
    return validationResult
}

/**
 * Validates and collects errors of each property as array of string
 * @param object
 * @param validationRule
 * @returns
 */
export const validateObject = <T, TRoot>(object: T, rootObject: TRoot, validationRule: ValidationRule<T, TRoot>): ErrorOf<T> => {
    if (!validationRule) {
        throw new Error(`validant: validation rule is null or undefined.`)
    }
    if (!object) {
        object = {} as T
    }
    var errors: ErrorOf<T> = undefined;

    function assignErrorsIfAny(key: any, violations: Violations | ErrorOfArray<T> | ErrorOf<T[Extract<keyof T, string>]>) {
        if (!errors) {
            errors = {};
        }
        errors[key as any] = violations
    }

    //Iterate against validation rule instead.
    //Example : the rule is {name:[required()]}, if we passed an empty object {}, then the validation wont work. It will always returns empty errors, which is very wrong. 
    for (const key in validationRule) {
        if (Object.prototype.hasOwnProperty.call(validationRule, key)) {
            const rule = validationRule[key];
            const value = object[key]
            if (!rule) {
                continue;
            }

            const allowedRules = ["array", "object", "function"]
            const typeOfRule = typeof rule
            const isValidRuleType = allowedRules.includes(typeOfRule)
            if (!isValidRuleType) {
                throw new Error(`${typeOfRule} is not a valid rule.`)
            }

            const isPrimitiveProperty = Array.isArray(rule)
            const isArrayProperty = isArrayValidationRule(rule)
            const isObjectProperty = typeof value === "object"

            if (isPrimitiveProperty) {
                const validationResult = validatePrimitiveField(key, object, rootObject, rule)
                if (!validationResult.isValid) {
                    assignErrorsIfAny(key, validationResult.errors)
                }
                continue
            }
            if (isArrayProperty) {
                const result = validateArrayField(key, object, rootObject, rule)
                if (result?.arrayErrors || result?.arrayElementErrors) {
                    assignErrorsIfAny(key, result)
                }
                continue
            }
            if (isObjectProperty) {
                const error = validateObjectField(key, object, rootObject, rule)
                if (error && !error.isValid) {
                    assignErrorsIfAny(key, error.errors)
                }
            }
        }
    }
    return errors;
};
