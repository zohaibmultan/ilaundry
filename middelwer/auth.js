const express = require('express');
const jwt = require('jsonwebtoken');
const {mySqlQury} = require('../middelwer/db');
const language = require("../public/language/languages.json");

const auth = async (req, res, next)=>{
  
        const token = req.cookies.webtoken
       
        if(!token){
            req.flash("error", "Your Are Not Authoried, Please Login first !!!!!!");
            return res.redirect('/')
        }

        let decode;
        try {
            decode = await jwt.verify(token, process.env.TOKEN_KEY);
        } catch (err) {
            req.flash("error", "Session expired or invalid, please login again");
            return res.redirect('/');
        }
        console.log("decode" , decode);
        req.user = decode

        const { createLanguageProxy } = require('./language');
        const lang = req.cookies.lang;
        let activeLang = 'en';
        if (lang) {
            try {
                const decode_lang = await jwt.verify(lang, process.env.TOKEN);
                if (decode_lang && decode_lang.lang) {
                    activeLang = decode_lang.lang;
                }
            } catch (err) {
                if (['en', 'in', 'pt', 'es', 'fr', 'cn', 'ae', 'id', 'ph', 'uk'].includes(lang)) {
                    activeLang = lang;
                }
            }
        }
        req.lang = { lang: activeLang };
        const langProxy = createLanguageProxy(activeLang);

        req.language_data = langProxy;
        req.language_name = activeLang;
        req.isRTL = (activeLang === 'ae');

        res.locals.language = langProxy;
        res.locals.language_name = activeLang;
        res.locals.isRTL = (activeLang === 'ae');
        res.locals.langJson = JSON.stringify(language[activeLang] || language.en || {});
        res.locals.t = (key, fallback) => langProxy[key] || fallback || (key ? String(key).replace(/_/g, ' ') : '');
        next();
        
    
}
 




module.exports = auth