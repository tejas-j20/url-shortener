package com.tejas.urlshortener.controller;

import com.tejas.urlshortener.dto.ShortenRequest;
import com.tejas.urlshortener.dto.ShortenResponse;
import org.springframework.web.bind.annotation.*;
import com.tejas.urlshortener.model.url;
import com.tejas.urlshortener.service.urlService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.beans.factory.annotation.Value;


import java.net.URI;
import java.util.Map;

// UrlController.java — handles the API, prefixed

@RequestMapping("/api/v1")
@CrossOrigin(origins = {"http://localhost:5173", "http://localhost:5174"})
@RestController
public class urlController {

    private final urlService urlService;
    @Value("${app.base-url:http://localhost:8080}")
    private String baseUrl;
    public urlController(urlService urlService) {
        this.urlService = urlService;
    }

    @PostMapping("/shorten")
    public ResponseEntity<ShortenResponse> shortenUrl(@RequestBody ShortenRequest request) {
        url savedUrl = urlService.generateShortLink(request.originalUrl());
        String fullShortUrl = baseUrl + "/" + savedUrl.getShortLink();
        ShortenResponse response = new ShortenResponse(
                savedUrl.getOriginalURL(),
                savedUrl.getShortLink(),
                fullShortUrl,
                savedUrl.getCreationDate().toString()
        );
        return ResponseEntity.ok(response);
    }
}

