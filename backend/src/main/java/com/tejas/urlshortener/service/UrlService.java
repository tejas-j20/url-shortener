package com.tejas.urlshortener.service;

import com.tejas.urlshortener.model.Url;
import com.tejas.urlshortener.repository.UrlRepository;
import org.springframework.stereotype.Service;
import java.time.ZoneOffset;

import java.time.LocalDateTime;
import java.util.Random;

@Service
public class UrlService {

    private final UrlRepository urlRepository;

    public UrlService(UrlRepository urlRepository) {
        this.urlRepository = urlRepository;
    }

    public Url generateShortLink(String originalUrl) {
        String randomString = generateRandomString();
        Url newUrl = new Url(originalUrl, randomString, LocalDateTime.now(ZoneOffset.UTC));
        return urlRepository.save(newUrl);
    }

    public Url getEncodedUrl(String shortLink) {
        return urlRepository.findByShortLink(shortLink);
    }

    private String generateRandomString() {
        String allowedCharacters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        StringBuilder shortLink = new StringBuilder();
        Random random = new Random();
        for (int i = 0; i < 6; i++) {
            int randomIndex = random.nextInt(allowedCharacters.length());
            shortLink.append(allowedCharacters.charAt(randomIndex));
        }
        return shortLink.toString();
    }
}