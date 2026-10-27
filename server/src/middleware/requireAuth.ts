import type {Request , Response , NextFunction} from 'express'
import jwt from 'jsonwebtoken';
export function requireAuth(req:Request , res : Response , next :NextFunction){
    const authorization = req.headers.authorization ;
    if(!authorization?.startsWith('Bearer ')){
        return res.status(401).json({message : 'Authentication required'});
    }
    const token = authorization.slice('Bearer '.length)
    const jwtsecret = process.env.JWT_SECRET;
    if(!jwtsecret){
        return res.status(500).json({
            message : 'Authentication is not configured',
        });
    }
    try{
        jwt.verify(token , jwtsecret , {algorithms : ['HS256']});
        next();
    }
    catch(e){
        return res.status(401).json({
            message : 'Token is invalid or expired'
        });
    }

}