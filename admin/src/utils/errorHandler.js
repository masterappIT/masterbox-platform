export const type = {
    INVALID_FORMAT: "INVALID_FORMAT",
    INVALID_PARAMS: "INVALID_PARAMS",
    MISS_REQUIRE_PARAMS: "MISS_REQUIRE_PARAMS",
    LOST_INTERNET_CONNECTION: "LOST_INTERNET_CONNECTION"
}




export default class errorHandler {

    #body = {
        type: null,
        message: null
    }

    constructor(type, param) {
        this.param = param;
        this.#body.type = type
    }


    createErrorMessage() {
        switch (this.#body.type) {
            case type.INVALID_PARAMS:
                this.#body.message = `Invalid ${this.param}`
            case type.INVALID_FORMAT:
                this.#body.message = `Invalid Format ${this.param}`
            default:
        }


        // if (this.type === type.INVALID_PARAMS) {
        //     this.#body.message = `Invalid ${this.param}`
        // } else if (this.type === type.INVALID_FORMAT) {
        //     this.#body.message = `Invalid Format ${this.param}`
        // }

        return this.#body.message

    }

    throwAlert() {
        return alert(`${this.#body.type}:${this.param}`)
    }
}


// new errorHandler(type.INVALID_PARAMS, 'email').createErrorMessage()