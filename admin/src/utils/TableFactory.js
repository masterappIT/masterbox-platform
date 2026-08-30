


import Toggle from "../stories/components/Toggle";



export const type = {
    UserManagementPage: "userMgmt",

}

/**
 * 
 * @param {"en" | "ch"} language 
 * @param {String} text 
 * @returns 
 */

const translateText = (language, text) => {

    return language + text;
}

const colMinMax = (cellWidths) => {


    let minmax = []


    cellWidths.forEach((cellWidth, i) => {
        if (i % 2 === 0) {

            return minmax.push(`minmax(${cellWidths[i]}, ${cellWidths[i + 1]})`)

        }
    })

    return `${minmax.join(' ')}`

}



class cell {
    /**
     * 
     * @param {String} key 
     * @param {String|Array} value 
     * @param {"toggle"| "icon" | "label" | "text" | "avatar" | "iconText" | "multipleAvatar"} element 
     */
    constructor(key, value, element) {

        this.key = key
        this.value = value
        this.element = element

    }


}

class userMgmtHeaders {

    cols = ["status", "img", "name", "id", "role", "email", "last_online_time", "is_online", "edit"]

    cellWidths = ["40px", "40px", "50px", "1fr", "50px", "1fr", "50px", "1fr", "50px", "1fr", "50px", "1fr", "50px", "2.5fr", "50px", "2fr", "70px", "1.2fr", "30px", "30px"]

    types = ["toggle", "avatar", "text", "text", "text", "text", "text", "label", "icon"]


}
class channelsMgmtHeaders {

    cols = ["status", "name",  "channel", "user"]

    // cellWidths = ["40px", "40px", "50px", "1fr", "50px", "1fr", "50px", "1fr", "50px", "1fr", "30px", "30px"]
    cellWidths = ["50px", "1fr", "50px", "1fr", "50px", "1fr", "50px", "1fr"]

    types = ["toggle", "text", "iconText",  "multipleAvatar"]


}

export class tableFactory {

    headers;

    rows;

    /**
     * 
     * @param {'userMgmt'} type 
     */
    constructor(type, rows) {

        switch (type) {
            case 'userMgmt':
                this.headers = new userMgmtHeaders();
                break;
            case 'channelsMgmt':
                this.headers = new channelsMgmtHeaders();
                break;

            default:
                break;
        }

        this.rows = rows
    }


    getHeaders() {
        return this.headers.cols
    }

    getHeadersTranslations(language) {

        return this.headers.cols.map(col => translateText(language, col))
    }

    getRowsData() {


        this.rows = this.rows.map((item, i) => {

            let rowsData = []

            this.headers.cols.map((key, ki) => {
                rowsData.push(new cell(key, item[key], this.headers.types[ki]))
            })

            return rowsData;
        })

        return this.rows

    }

    generateInputsData() {


    }

    getGridTemplate() {

        return colMinMax(this.headers.cellWidths)
    }


}



