

describe('login', () => {


    it('should login success', () => {

        cy.visit('/auth')

        cy.fixture('user/user.json').then((user) => {

            cy.get('input[name="email"]').type(user.email)

            cy.get('input[name="password"]').type(user.password)


            cy.get('.button').contains('登入').click().then(() => {



                cy.url().should('eq', 'http://localhost:3000/')
            })



        })
    })

    it('should login failure, and show up a alert', () => {

        cy.visit('/auth')

        cy.fixture('user/dummy.json').then((user) => {


            cy.get('input[name="email').type(user.email)

            cy.get('input[name="password').type(user.password)

            cy.get('.button').contains('登入').click().wait(1000).then(() => {

                cy.url().should('not.eq', 'http://localhost:3000/')
            })












        })
    })
})