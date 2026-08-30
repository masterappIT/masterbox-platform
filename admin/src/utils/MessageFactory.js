import { timeGenerator } from "./utils"

class fbMessage {

    constructor(contents) {
        this.recipient = { id: contents.recipient }
        this.messaging_type = contents.messaging_type || 'RESPONSE'
        this.message = contents.message
    }
}

class testMessage {
    constructor(contents) {
        this.account = 'test'
        this.message = contents
        this.time = timeGenerator()
    }
}


export class MessageFactory {

    #body = {

    }

    constructor(to_chat_room_id, platform, channel_id) {
        this.#body.to_chat_room_id = to_chat_room_id
        this.#body.platform = platform
        this.#body.channel_id = channel_id
    }


    createContents(contents) {

        if (!this.#body.platform) {
            return "unable to make message. Please specify a platform and try again!"
        }


        if (this.#body.platform === "fb" || this.#body.platform === "ig") {
            console.log('this.#body.platform :>> ', this.#body.platform);
            this.#body.contents = new fbMessage(contents);
        }

        if (this.#body.platform === "test") {
            this.#body.contents = new testMessage(contents);
        }

        console.log('this.#body :>> ', this.#body);
        // message.vehicleType = vehicleType;

        // vehicle.startEngine = ()=> console.log(`Reving ${vehicleType} engine`);

        // vehicle.driveVehicle = ()=> console.log(`Driving ${vehicleType}...`);

        // vehicle.stopEngine = ()=> console.log(`Stop ${vehicleType} engine`);

        return { ...this.#body, contents: JSON.stringify(this.#body.contents) }
    }

};