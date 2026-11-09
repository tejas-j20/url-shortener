package com.tejas.urlshortener.controller;

import com.tejas.urlshortener.model.Url;
import com.tejas.urlshortener.service.UrlService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;

// RedirectController.java — NEW separate file, no prefix at all
@RestController
public class RedirectController {

    private final UrlService urlService;

    public RedirectController(UrlService urlService) {
        this.urlService = urlService;
    }

    @GetMapping("/{shortLink}")
    public ResponseEntity<Void> redirect(@PathVariable String shortLink) {
        Url found = urlService.getEncodedUrl(shortLink);
        if (found == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.status(HttpStatus.FOUND)
                .location(URI.create(found.getOriginalUrl()))
                .build();
    }
}
