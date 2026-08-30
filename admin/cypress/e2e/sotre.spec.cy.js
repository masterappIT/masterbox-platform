describe("LOAD OK", function () {
    it("should load without crashing", function () {
        cy.visit('/');
    });

    it("should have the right initial state", function () {
        cy.window()
            .its("store")
            .invoke("getState")
            .should("deep.contains", {
                app: {
                    lang: '',
                    loading: true
                },
                user: {
                    info: {

                    },
                    accessToken: null,
                    courseOrders: []
                }
            });
    });
});