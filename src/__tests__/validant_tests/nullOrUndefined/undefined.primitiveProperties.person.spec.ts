import { Validator, ValidationResult, required, ValidationRule } from "../../../index"

interface Person {
    name?: string
    age?: 1
}

describe("Test Against undefined properties with undefined rules", () => {
    it("return true", () => {

        const rule: ValidationRule<Person> = {
            name: [undefined],
            age: undefined
        }

        const person: Person = {}

        const validator = new Validator(rule)
        const actual = validator.validate(person)

        const expected: ValidationResult<Person> = {
            message: "Good to go.",
            isValid: true,
            errors: undefined
        }

        expect(actual).toEqual(expected)
    })
})

describe("Test Simple Object", () => {
    it("return true", () => {

        const rule: ValidationRule<Person> = {
            name: [required()],
            age: [required()]
        }
        const person: Person = {}
        
        const validator = new Validator(rule)
        const actual = validator.validate(person)

        const expected: ValidationResult<Person> = {
            message: "One or more validation errors occurred.",
            isValid: false,
            errors: {
                name: ["This field is required."],
                age: ["This field is required."],
            }
        }

        expect(actual).toEqual(expected)
    })
})