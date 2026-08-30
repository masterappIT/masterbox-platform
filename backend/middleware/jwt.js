/*
 * @Description:
 * @Author: Kenzi
 * @Date: 2021-06-10 18:32:02
 * @LastEditTime: 2021-08-07 09:14:06
 * @LastEditors: Kenzi
 */

import jwt from "jsonwebtoken";
import user from "../controllers/user.js";
import makeValidation from "@withvoid/make-validation";
import bcrypt from "bcrypt";
import { online_users } from "../utils/WebSockets.js";
import createError from "http-errors";
import client from "../config/redis.js";
import naclUtil from "tweetnacl-util";

const accessTokenExpiration = "1h";
const refreshTokenExpiration = "1y";

export default {
    signAccessToken: async (req, res, next) => {
        try {
            const validation = makeValidation((types) => ({
                payload: req.body,
                checks: {
                    username: { type: types.string, required: true },
                    password: { type: types.string, required: true },
                },
            }));
            if (!validation.success) return next(createError(400, validation.errors));
            const { username, password, device_id } = req.body;
            //查找用户
            const hasUser = await user.onGetUserByUsername(username);

            console.log("hasUser :>> ", hasUser);
            if (hasUser) {
                //核对密码
                const validPass = bcrypt.compareSync(password, hasUser.password);
                if (!validPass) return next(createError(400, "Password is wrong"));
                const payload = {
                    user_id: hasUser._id,
                };

                //创建token

                const accessToken = jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, {
                    expiresIn: accessTokenExpiration,
                });

                //获取用户的private key
                const searchRedisKey = naclUtil.encodeBase64(
                    `${username}${hasUser._id}`
                );

                const userPrivateKey = await client.GET(searchRedisKey);

                //獲取用戶的private key for group chatRoom
                const searchRedisKeyForGroup = naclUtil.encodeBase64(
                    `${username}${hasUser._id}Group`
                );
                const userPrivateKeyForGroup = await client.GET(searchRedisKeyForGroup);

                // if (!userPrivateKey || !userPrivateKeyForGroup)
                //   return next(createError.Unauthorized());

                req.accessToken = accessToken;
                req.publicKey = hasUser.public_key;
                req.publicKeyGroup = hasUser.public_key_group;
                req.privateKey = userPrivateKey;
                req.privateKeyGroup = userPrivateKeyForGroup;
                req.userInfo = {
                    _id: hasUser._id,
                    avatar: hasUser.avatar,
                    name: hasUser.name,
                    status: hasUser.status,
                    public_id: hasUser.public_id,
                    username: hasUser.username,
                };
            } else {
                return next(createError(400, "Username is wrong or no such user"));
            }

            return next();
        } catch (error) {
            console.log("error :>> ", error);
            return next(createError.InternalServerError());
        }
    },

    verifyAccessToken: (req, res, next) => {
        try {
            if (!req.headers["authorization"])
                return next(createError(400, "No access token provided"));
            const authorization = req.headers.authorization.split(" ");
            const accessToken = authorization[1];
            const client_socket_id = authorization[3];
            const device_id = authorization[5];
            const decoded = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);
            if (!decoded) return next(createError.Unauthorized());
            const user_id = decoded.user_id;
            req.device_id = device_id;
            req.user_id = user_id;
            req.socket_id = client_socket_id;
            return next();
        } catch (error) {
            console.log("error :>> ", error);
            return next(createError.Unauthorized());
        }
    },
    signRefreshToken: (req, res, next) => {
        try {
            const secret = process.env.REFRESH_TOKEN_SECRET;

            const { userInfo, device_id } = req;
            const payload = { user_id: userInfo._id };
            const refreshToken = jwt.sign(payload, secret, {
                expiresIn: refreshTokenExpiration,
            });
            const saveToRedis = client.SET(
                userInfo._id,
                refreshToken,
                "EX",
                365 * 24 * 60 * 60
            );

            req.refreshToken = refreshToken;
            return next();
        } catch (error) {
            console.log("error :>> ", error);
            return next(createError.Unauthorized());
        }
    },

    verifyRefreshToken: async (req, res, next) => {
        try {
            const oldRefreshToken = req.body.refreshToken;
            //验证refreshToken是否有效
            const decode = jwt.verify(
                oldRefreshToken.split(" ")[1],
                process.env.REFRESH_TOKEN_SECRET
            );

            const { user_id } = decode;
            const validFreshToken = await client.get(user_id);

            if (validFreshToken !== oldRefreshToken.split(" ")[1])
                return next(createError.Unauthorized());

            const payload = {
                user_id: user_id,
            };

            //创建新的accessToken
            const accessToken = jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: accessTokenExpiration,
            });

            //创建新的refreshToken
            const refreshToken = jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, {
                expiresIn: refreshTokenExpiration,
            });

            const saveToRedis = client.SET(
                user_id,
                refreshToken,
                "EX",
                365 * 24 * 60 * 60
            );

            req.accessToken = accessToken;
            req.refreshToken = refreshToken;
            return next();
        } catch (error) {
            console.log("error :>> ", error);
            return next(createError.Unauthorized());
        }
    },

    verifyAccessTokenFromUrl: (req, res, next) => {

        if (!req.params.token) {
            return res
                .status(400)
                .json({ success: false, message: "No access token provided" });
        }
        const accessToken = req.params.token;

        try {
            const decoded = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);
            const user_id = decoded.user_id;
            req.user_id = user_id;
            return next();
        } catch (error) {
            console.log("error :>> ", error);
            return next(createError.Unauthorized());
        }
    },
};