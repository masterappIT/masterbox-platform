

describe('register', () => {


    it('should register success', () => {

        cy.visit('/auth')
        cy.get('.contentText').contains('免費註冊試用').click()

        cy.fixture('company/company.json').then(({ correct }) => {
            let { chinese_name, english_name, email, password, mobile } = correct

            cy.get('input[name="chinese_name').type(chinese_name)

            cy.get('input[name="english_name').type(english_name)

            cy.get('input[name="email').type(email)

            cy.get('input[name="password').type(password)

            cy.get('input[name="country').click()
            cy.get('.country').first().click()

            cy.get('input[name="mobile').first().click()

            cy.get('.mobile').first().click()

            cy.get('input[name="mobile').last().type(mobile)

            cy.get('.button').contains('立即註冊').click().wait(2000).then(() => {

                cy.url().should('eq', 'http://localhost:3000/')

            })











        })
    })
    // it('should register failure, and show up a alert', () => {

    //     cy.visit('/auth')
    //     cy.get('.contentText').contains('免費註冊試用').click()

    //     cy.fixture('company/dummy.json').then(({ failingEmail }) => {
    //         let { chinese_name, english_name, email, password, mobile } = failingEmail

    //         cy.get('input[name="chinese_name').type(chinese_name)

    //         cy.get('input[name="english_name').type(english_name)

    //         cy.get('input[name="email').type(email)

    //         cy.get('input[name="password').type(password)

    //         cy.get('input[name="country').click()
    //         cy.get('.country').first().click()

    //         cy.get('input[name="mobile').first().click()
    //         cy.get('.mobile').first().click()
    //         cy.get('input[name="mobile').last().type(mobile)

    //         cy.get('.button').contains('立即註冊').click()

    //         // cy.get('span').contains('isLogin:true')

    //     })
    // })

    // it('should register failure, and show up a alert', () => {

    //     cy.visit('/auth')

    //     cy.fixture('user/dummy.json').then((user) => {


    //         cy.get('input[name="email').type(user.email)

    //         cy.get('input[name="password').type(user.password)

    //         cy.get('.button').contains('登入').click()

    //         cy.get('span').contains('false')

    //         cy.on('window:alert', (str) => {
    //             expect(str).to.equal('Incorrect email')
    //         })

    //     })
    // })
})