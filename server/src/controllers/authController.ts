import type {Request , Response} from 'express';
import User from "../models/User.js"
import bcrypt from 'bcrypt'
import { createAuthToken } from '../services/tokenService.js';

export async function registerUser(req:Request , res: Response){
    const email = req.body?.email;
    const password = req.body?.password;
    
    if(typeof email !== "string" || typeof password !=="string"){
        return res.status(400).json({message : "Email and password are required"})
    }
    if(email.trim()==='' ||password.length ===0){
        return res.status(400).json({message : 'Email and password cannot be empty'})
    }
    if(Buffer.byteLength(password , 'utf8')>72){
        return res.status(400).json({
            message : 'Password must be 72 bytes or fewer.',
        }); 
    }
    const normalEmail = email.trim().toLowerCase();
    try{
    const existingUser = await User.findOne({email: normalEmail})
    if(existingUser){
        return res.status(409).json({
            message : "An account with this email already exists.",
        })
    }
    const passwordHash = await bcrypt.hash(password , 10);
    const createdUser = await User.create({
        email: normalEmail,
        passwordHash: passwordHash,
    })
    const token = createAuthToken(createdUser._id.toString());

    res.status(201).json({
        message:"Account created",
        token,
        user:{
            id:createdUser._id,
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
      message: 'An account with this email already exists.',
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
