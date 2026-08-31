import { ApolloClient, createHttpLink, InMemoryCache, split } from '@apollo/client';
import { getMainDefinition } from '@apollo/client/utilities';
import { setContext } from '@apollo/client/link/context';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';

const getAccessToken = () => {
    if (typeof window === 'undefined') return null;
    const directToken = window.localStorage.getItem('accessToken');
    if (directToken) return directToken;

    try {
        const persistedRoot = JSON.parse(window.localStorage.getItem('persist:root') || '{}');
        const user = typeof persistedRoot.user === 'string'
            ? JSON.parse(persistedRoot.user)
            : persistedRoot.user;
        return user?.accessToken || null;
    } catch (_) {
        return null;
    }
};

const apiUri = process.env.NODE_ENV === 'production' ? process.env.GRAPHQL_CONNECTION_PRODUCTION : process.env.GRAPHQL_CONNECTION_DEV
const wsUri = process.env.NODE_ENV === 'production' ? process.env.GRAPHQL_WS_CONNECTION_PRODUCTION : process.env.GRAPHQL_WS_CONNECTION_DEV

const httpLink = createHttpLink({
    uri: apiUri,
    credentials: 'include',
})

// const wsLink = process.browser
//     ? new WebSocketLink(
//         new SubscriptionClient('ws://localhost:4000/graphql', {
//             reconnect: true
//         })
//     ) : null;


const wsLink =
    typeof window !== "undefined"
        ? new GraphQLWsLink(
            createClient({
                url: wsUri,
                connectionParams: async () => {
                    const token = getAccessToken();
                    return token ? { authorization: "Bearer " + token } : {};
                },

                reconnect: true,

            })
        )
        : wsUri;




const authLink = setContext((_, { headers }) => {
    const token = getAccessToken();
    return { headers: { ...headers, ...(token ? { authorization: "Bearer " + token } : {}) } };
});


const splitLink = typeof window !== "undefined" && wsLink != null
    ? split(
        ({ query }) => {
            const def = getMainDefinition(query);
            return (
                def.kind === "OperationDefinition" &&
                def.operation === "subscription"
            );
        },
        wsLink,
        authLink.concat(httpLink)
    )
    : authLink.concat(httpLink)
    ;

export const client = new ApolloClient({
    link: splitLink,
    cache: new InMemoryCache(),
    // ssrMode: true,
})

class apolloReqBuilder {

    #body = {}

    #typeOptions = ['mutation', 'query', 'subscription']

    constructor(type) {

        this.type = type

    }

    setBody(body) {
        this.#body[this.type] = body
        return this
    }

    setVariables(variables) {
        this.#body['variables'] = variables;
        return this
    }

    callApi() {

        if (!('type' in this)) {
            throw new Error('type is missing')
        }

        if (!this.#typeOptions.includes(this.type)) {
            throw new Error('type is not allowed')
        }

        if (this.#body[this.type] === {}) {
            throw new Error('body is missing')

        }

        if (this.type === 'query') {
            // console.log(' apolloApiHelpers:>> callApi2 ', this.type,"query");

            return client.query(this.#body)
        }

        if (this.type === 'mutation') {
            // console.log(' apolloApiHelpers:>> callApi3 ', this.type,"mutation");

            // console.log('this.#body', this.#body)
            return client.mutate(this.#body)
        }
        if (this.type === 'subscription') {
            return client.subscribe(this.#body)
        }
        console.log('apolloReqBuilder', this.type)
    }


}


/**
 * 
 * @param {('query' | 'mutation' | 'subscription')} type
 * @param {Object} gqlOptions - gql schema
 * @param {Object} variables
 * @returns 
 */
export const apolloApiHelpers = async (type, gqlOptions, variables,) => {

    try {

        // console.log(' apolloApiHelpers:>> variables', variables)

        const reqBody = new apolloReqBuilder(type).setBody(gqlOptions);

        // console.log(' apolloApiHelpers:>> reqBody ', reqBody.callApi);

        if (variables) reqBody.setVariables(variables);

        //for extra the data from res
        const reqName = getMainDefinition(gqlOptions).selectionSet.selections[0].name.value

        console.log(' apolloApiHelpers:>> reqName1 ', reqName);


        const res = await reqBody.callApi();


        console.log(' apolloApiHelpers:>> reqName2 ', res);
        // console.log(' apolloApiHelpers:>> reqName3 ', error);


        // if (error&&error.includes('INTERNAL_SERVER_ERROR')) {
        //     console.log(' apolloApiHelpers:>> Expired ????? ', res);
        //     const res = store.dispatch(handleTokenExpired)
        //     console.log(' apolloApiHelpers:>> Expired  ', res);

        //     if (res.error) {
        //         alert('請重新登入')
        //         store.dispatch(removeAccessToken())
        //         // router.reload()
        //     } else {
        //         // res會拿到access token（短期） &refresh token（長期）
        //         await apolloApiHelpers(type, gqlOptions, variables);
        //     }
        // }



        return res.data[reqName] || res
    } catch (error) {
        // console.log('error :>> ', error);
        return { error: error.message }
    }
}




export default client;
