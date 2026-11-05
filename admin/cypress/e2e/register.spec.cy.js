

describe('register', () => {

    // Emails and mobile numbers are unique, so each run registers a new company.
    const uniqueId = Date.now()
    const email = `register-${uniqueId}@example.com`
    const mobile = `8869${String(uniqueId % 1e8).padStart(8, '0')}`

    const submitRegisterForm = (registerEmail, registerMobile) => {
        // The previous test's page can persist its session again after Cypress clears storage.
        cy.visit('/auth', { onBeforeLoad: (win) => win.localStorage.clear() })
        cy.get('.contentText').contains('忘記密碼').click()
        cy.get('.contentText').contains('免費註冊試用').click()

        cy.fixture('company/company.json').then(({ correct }) => {
            const { chinese_name, english_name, password } = correct

            cy.get('input[name="chinese_name"]').type(chinese_name)

            cy.get('input[name="english_name"]').type(english_name)

            cy.get('input[name="email"]').type(registerEmail)

            cy.get('input[type="password"]').type(password)

            cy.get('input[name="country"]').click()
            cy.get('.country').first().click()

            cy.get('input[type="tel"]').type(registerMobile)

            cy.get('.button').contains('立即註冊').click()
        })
    }

    it('should register success', () => {
        submitRegisterForm(email, mobile)

        cy.location('pathname', { timeout: 20000 }).should('eq', '/')
    })

    it('should show an error when the email is already registered', () => {
        submitRegisterForm(email, `8869${String((uniqueId + 1) % 1e8).padStart(8, '0')}`)

        cy.contains('此電子信箱已註冊，請直接登入').should('be.visible')
        cy.location('pathname').should('eq', '/auth')
    })

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