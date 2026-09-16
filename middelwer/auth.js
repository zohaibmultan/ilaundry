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

        const lang = req.cookies.lang
        let decode_lang = { lang: 'en' };
        if (lang) {
            try {
                decode_lang = await jwt.verify(lang, process.env.TOKEN);
            } catch (err) {
                decode_lang = { lang: 'en' };
            }
        }
        req.lang = decode_lang

        if (decode_lang.lang == 'en') {
            let data = language.en
            req.language_data = data
            req.language_name = 'en'
        } else if (decode_lang.lang == 'es') {
            let data = language.es
            req.language_data = data
            req.language_name = 'es'
        } else if (decode_lang.lang == 'fr') {
            let data = language.fr
            req.language_data = data
            req.language_name = 'fr'
        } else if (decode_lang.lang == 'pt') {
            let data = language.pt
            req.language_data = data
            req.language_name = 'pt'
        } else if (decode_lang.lang == 'cn') {
            let data = language.cn
            req.language_data = data
            req.language_name = 'cn'
        } else if (decode_lang.lang == 'ae') {
            let data = language.ae
            req.language_data = data
            req.language_name = 'ae'
        } else if (decode_lang.lang == 'in') {
            let data = language.in
            req.language_data = data
            req.language_name = 'in'
        } else if (decode_lang.lang == 'id') {
            let data = language.id
            req.language_data = data
            req.language_name = 'id'
        } else if (decode_lang.lang == 'ph') {
            let data = language.ph
            req.language_data = data
            req.language_name = 'ph'
        } else if (decode_lang.lang == 'uk') {
            let data = language.uk
            req.language_data = data
            req.language_name = 'uk'
        }
        next()
        
    
}
 




module.exports = auth