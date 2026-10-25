package com.tejas.urlshortener.repository;

import com.tejas.urlshortener.model.url;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface urlRepository extends JpaRepository<url, Long> {
    url findByShortLink(String shortLink);
}

