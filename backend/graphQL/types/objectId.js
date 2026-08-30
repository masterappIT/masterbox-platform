import { GraphQLScalarType } from 'graphql';
import { objectIdGenerator } from '../../utils/utils.js';


export const objectIdScalar = new GraphQLScalarType({
    name: 'ObjectId',
    description: 'String identifier used by the API',

    parseValue: (value) => {
        const objectId = objectIdGenerator(value)
        console.log('value :>> ', objectId);
        return objectId
    },

    serialize: (value) => {
        console.log('valueserialize :>> ', value);
        return value;
    },



});