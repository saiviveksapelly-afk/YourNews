import type {Request , Response} from 'express';
import User from "../models/User.js"
import bcrypt from 'bcrypt'
import { createAuthToken } from '../services/tokenService.js';

export async function registerUser(req:Request , res: Response){
    const username = req.body?.username;
    const email = req.body?.email;
    const password = req.body?.password;
    
    if(typeof username !== 'string' || typeof email !== 'string' || typeof password !== 'string'){
        return res.status(400).json({message : 'Username, email, and password are required.'})
    }
    const normalUsername = username.trim().toLowerCase();
    const normalEmail = email.trim().toLowerCase();

    if (!/^[a-z0-9_]{3,30}$/.test(normalUsername)) {
        return res.status(400).json({
            message: 'Username must be 3–30 characters and use only letters, numbers, or underscores.',
        });
    }

    const meetsPasswordPolicy =
        password.length >= 10 &&
        /[a-z]/.test(password) &&
        /[A-Z]/.test(password) &&
        /\d/.test(password) &&
        /[^A-Za-z0-9\s]/.test(password);

    if (!meetsPasswordPolicy) {
        return res.status(400).json({
            message: 'Password must be at least 10 characters and include an uppercase letter, a lowercase letter, a number, and a special character.',
        });
    }
    if(Buffer.byteLength(password , 'utf8')>72){
        return res.status(400).json({
            message : 'Password is too long. Use 72 bytes or fewer.',
        }); 
    }
    try{
    const existingUser = await User.findOne({
        $or: [{ email: normalEmail }, { username: normalUsername }],
    })
    if(existingUser){
        return res.status(409).json({
            message : 'That username or email is already in use. Choose another or sign in.',
        })
    }
    const passwordHash = await bcrypt.hash(password , 10);
    const createdUser = await User.create({
        username: normalUsername,
        email: normalEmail,
        passwordHash: passwordHash,
    })

    return res.status(201).json({
        message: 'Account created. Please sign in.',
        user:{
            id: createdUser._id.toString(),
            username: createdUser.username,
            email: createdUser.email,
        }
    })
} catch (error) {
  console.error('Registration failed:', error);

  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 11000
  ) {
    return res.status(409).json({
      message: 'That username or email is already in use. Choose another or sign in.',
    });
  }

  return res.status(500).json({
    message: 'Could not create account.',
  });
}
}
export async function loginUser(req:Request , res:Response){
    const email = req.body?.email;
    const password = req.body?.password;
    if(typeof email !=='string' || typeof password !== 'string'){
        return res.status(400).json({
            message:"Email and password are required" 
     })
    }
    if( email.trim() ==='' || password.length ===0){
        return res.status(400).json({
            message: "Email and password cannot be empty"
        })
    }
    if(Buffer.byteLength(password , 'utf8')>72){
        return res.status(400).json({
            message : "Password must be 72 bytes or fewer"
        })
    }
    const normalEmail = email.trim().toLowerCase();
    try{
        const user = await User.findOne({ email : normalEmail}).select('+passwordHash'); 
        const isPasswordValid = user ? await bcrypt.compare(password , user.passwordHash) : false;
        if(!user || !isPasswordValid){
            return res.status(401).json({message : "Invalid email or password"});
        }
        const token = createAuthToken(user._id.toString());
    return res.status(200).json({
    message: 'Login successful.',
     token,
        user: {
        id: user._id.toString(),
        email: user.email,
    },
});    
    }catch (error) {
  console.error('Login failed:', error);
  return res.status(500).json({ message : "Could not log in."});
}
}
