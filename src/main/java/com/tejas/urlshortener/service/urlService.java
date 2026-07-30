package com.tejas.urlshortener.service;


import com.tejas.urlshortener.model.url;
import com.tejas.urlshortener.repository.urlRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Random;

@Service
public class urlService {

    private final urlRepository myRepository;


    public urlService(urlRepository myRepository) {
        this.myRepository = myRepository;
    }

    public url generateShortLink(String originalUrl){
        String randomString = generateRandomString();
        url newurl = new url(originalUrl, randomString, LocalDateTime.now());
        return myRepository.save(newurl);
    }

    public static url getEncodedUrl(String shortLink){
        return urlRepository.findByShortLink(shortLink);
    }

    private String generateRandomString(){
        String allowedCharacters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        StringBuilder shortLink = new StringBuilder();
        Random random = new Random();

        for(int i=0; i<6; i++){
            int randomIndex = random.nextInt(allowedCharacters.length());
            shortLink.append(allowedCharacters.charAt(randomIndex));
        }
        return shortLink.toString();
    }
}
