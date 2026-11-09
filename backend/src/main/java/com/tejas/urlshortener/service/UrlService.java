package com.tejas.urlshortener.service;

import com.tejas.urlshortener.model.Url;
import com.tejas.urlshortener.repository.UrlRepository;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

@Service
public class UrlService {

    private static final String CHARACTERS =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    private static final int CODE_LENGTH = 6;
    private static final int MAX_ATTEMPTS = 5;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final UrlRepository urlRepository;

    public UrlService(UrlRepository urlRepository) {
        this.urlRepository = urlRepository;
    }

    public Url generateShortLink(String originalUrl) {
        for (int attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            String code = generateRandomString();
            if (!urlRepository.existsByShortLink(code)) {
                Url newUrl = new Url(originalUrl, code, LocalDateTime.now(ZoneOffset.UTC));
                return urlRepository.save(newUrl);
            }
        }
        throw new IllegalStateException("Could not generate a unique short link");
    }

    @Cacheable(value = "urls", key = "#shortLink", unless = "#result == null")
    public Url getEncodedUrl(String shortLink) {
        return urlRepository.findByShortLink(shortLink);
    }

    private String generateRandomString() {
        StringBuilder code = new StringBuilder();
        for (int i = 0; i < CODE_LENGTH; i++) {
            code.append(CHARACTERS.charAt(RANDOM.nextInt(CHARACTERS.length())));
        }
        return code.toString();
    }
}