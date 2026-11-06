import { ApolloClient, createHttpLink, fromPromise, InMemoryCache, split } from '@apollo/client';
import { getMainDefinition } from '@apollo/client/utilities';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';

export const getAccessToken = () => {
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
// REST endpoints such as attachment uploads live on the same API host.
export const apiBaseUri = process.env.NODE_ENV === 'production' ? process.env.API_CONNECTION_PRODUCTION : process.env.API_CONNECTION_DEV
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

            })
        )
        : wsUri;




// The backend rejects the whole request when it carries an expired token, so these must go without one.
const PUBLIC_OPERATIONS = ['LoginAccount', 'RefreshToken', 'RegisterCompanyAccount'];

const authLink = setContext(({ operationName }, { headers }) => {
    const token = PUBLIC_OPERATIONS.includes(operationName) ? null : getAccessToken();
    return { headers: { ...headers, ...(token ? { authorization: "Bearer " + token } : {}) } };
});

let pendingRefresh = null;

export const refreshSession = () => {
    pendingRefresh ||= (async () => {
        const { default: store, persistor } = await import('../redux/store');
        const { handleTokenExpired } = await import('../redux/slices/userSlices');
        const { payload: token } = await store.dispatch(handleTokenExpired());
        await persistor.flush();
        if (!token && !store.getState().user.accessToken) client.clearStore();
        if (!token) throw new Error('Session expired');
        return token;
    })().finally(() => { pendingRefresh = null; });
    return pendingRefresh;
};

const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
    const errors = [...(graphQLErrors || []), ...(networkError?.result?.errors || [])];
    const isUnauthenticated = errors.some(error => error.extensions?.code === 'UNAUTHENTICATED');
    if (!isUnauthenticated || PUBLIC_OPERATIONS.includes(operation.operationName) || !getAccessToken()) return;

    return fromPromise(refreshSession()).flatMap((token) => {
        operation.setContext(({ headers }) => ({ headers: { ...headers, authorization: "Bearer " + token } }));
        return forward(operation);
    });
});

const httpChain = authLink.concat(errorLink).concat(httpLink);


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
        httpChain
    )
    : httpChain
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

    setOptions(options) {
        Object.assign(this.#body, options);
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
 * @param {Object} options - extra client options, e.g. fetchPolicy
 * @returns 
 */
export const apolloApiHelpers = async (type, gqlOptions, variables, options) => {

    try {

        // console.log(' apolloApiHelpers:>> variables', variables)

        const reqBody = new apolloReqBuilder(type).setBody(gqlOptions);

        // console.log(' apolloApiHelpers:>> reqBody ', reqBody.callApi);

        if (variables) reqBody.setVariables(variables);

        if (options) reqBody.setOptions(options);

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
        // extensions carry details a caller may act on, such as a reply whose file went out but whose text didn't.
        return { error: error.message, extensions: error.graphQLErrors?.[0]?.extensions }
    }
}




export default client;
