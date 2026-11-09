package com.tejas.urlshortener.controller;

import com.tejas.urlshortener.dto.ShortenRequest;
import com.tejas.urlshortener.dto.ShortenResponse;
import com.tejas.urlshortener.model.Url;
import com.tejas.urlshortener.service.UrlService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.beans.factory.annotation.Value;
import java.time.ZoneOffset;
import java.net.URISyntaxException;


import java.net.URI;
import java.util.Map;

@RequestMapping("/api/v1")
@CrossOrigin(origins = {"http://localhost:3000", "http://localhost:5173", "http://localhost:5174"})
@RestController
public class UrlController {

    UrlService urlService;
    @Value("${app.base-url:http://localhost:8080}")
    private String baseUrl;
    public UrlController(UrlService urlService) {
        this.urlService = urlService;
    }

    @PostMapping("/shorten")
    public ResponseEntity<ShortenResponse> shortenUrl(@RequestBody ShortenRequest request) {
        if (!isValidUrl(request.originalUrl())) {
            return ResponseEntity.badRequest().build();
        }
        Url savedUrl = urlService.generateShortLink(request.originalUrl());
        String fullShortUrl = baseUrl + "/" + savedUrl.getShortLink();
        ShortenResponse response = new ShortenResponse(
                savedUrl.getOriginalUrl(),
                savedUrl.getShortLink(),
                fullShortUrl,
                savedUrl.getCreationDate().atOffset(ZoneOffset.UTC).toString()        );
        return ResponseEntity.ok(response);
    }
    private boolean isValidUrl(String value) {
        if (value == null || value.isBlank() || value.length() > 2048) {
            return false;
        }
        try {
            URI uri = new URI(value);
            String scheme = uri.getScheme();
            return scheme != null
                    && (scheme.equalsIgnoreCase("http") || scheme.equalsIgnoreCase("https"))
                    && uri.getHost() != null;
        } catch (URISyntaxException e) {
            return false;
        }
    }
}

