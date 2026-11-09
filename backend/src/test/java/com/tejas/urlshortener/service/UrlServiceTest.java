package com.tejas.urlshortener.service;

import com.tejas.urlshortener.model.Url;
import com.tejas.urlshortener.repository.UrlRepository;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class UrlServiceTest {

    private final UrlRepository urlRepository = mock(UrlRepository.class);
    private final UrlService urlService = new UrlService(urlRepository);

    @Test
    void createsSixCharacterCodeAndSavesIt() {
        when(urlRepository.save(any(Url.class))).thenAnswer(inv -> inv.getArgument(0));

        Url result = urlService.generateShortLink("https://example.com");

        assertEquals("https://example.com", result.getOriginalUrl());
        assertEquals(6, result.getShortLink().length());
        verify(urlRepository).save(any(Url.class));
    }

    @Test
    void triesAgainWhenCodeAlreadyExists() {
        when(urlRepository.existsByShortLink(anyString())).thenReturn(true, false);
        when(urlRepository.save(any(Url.class))).thenAnswer(inv -> inv.getArgument(0));

        urlService.generateShortLink("https://example.com");

        verify(urlRepository, times(2)).existsByShortLink(anyString());
    }
}