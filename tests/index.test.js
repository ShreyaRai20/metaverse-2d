const axios = require("axios");

const BACKEND_URL = "http://localhost:3000"

describe("authentication", () => {
    test('User is able to sign up', async () => {
        const username = "shreya" + Math.random();
        const password = "123456";
        const response = await axios.post(
            `${BACKEND_URL}/api/v1/signup`, 
            {
                username,
                password,
                type: "admin"
            }
        );

        expect(response.statusCode).toBe(200);

        const updatedResponse = await axios.post(
            `${BACKEND_URL}/api/v1/signup`, 
            {
                username,
                password,
                type: "admin"
            }
        );

        expect(updatedResponse.statusCode).toBe(400);
    });

    test('signup request fails if the username is empty', async () => {
        const username = "shreya" + Math.random();
        const password = "123456"
        const response = await axios.post(
            `${BACKEND_URL}/api/v1/signup`, 
            {
                password
            }
        )

        expect(response.statusCode).toBe(400)
    });
});