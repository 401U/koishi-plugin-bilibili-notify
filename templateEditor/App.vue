<script setup lang="ts">
import styleTmpl from '../src/template/style.css?raw'
import majorArchive from '../src/template/dynamic/majorArchive.vue?raw'
import dynamicMain from '../src/template/dynamic/main.vue?raw'
import additionalReserved from '../src/template/dynamic/additionalReserved.vue?raw'
import { DynamicItem } from '../src/bean.ts'
import List1 from './data/dynamics/list1.json'
import { useHandlebars } from '../src/useHandlebars.ts'
import { onMounted, ref } from 'vue'

const dynamicListRaw: DynamicItem[] = List1

const templateLoader = async (path: string) => {
    let result = ''
    switch (path) {
        case '../src/template/style.css':
            result = styleTmpl
            break
        case '../src/template/dynamic/majorArchive.vue':
            result = majorArchive
            break
        case '../src/template/dynamic/main.vue':
            result = dynamicMain
            break
        case '../src/template/dynamic/additionalReserved.vue':
            result = additionalReserved
            break
        default:
    }
    return result
}
let mainContent = ref([] as string[])
onMounted(async() => {
    const handlebarsInstance = await useHandlebars('../src/template', templateLoader)
    let styleText = ''
    dynamicListRaw.forEach(rawData => {
        try {
            const { html: dynamicMainContent, css: scopeCss} = handlebarsInstance.compileDynamic(rawData)
            if(scopeCss && styleText.length == 0) styleText = scopeCss
            let prefix = `<div>${rawData.id_str}</div>`
            mainContent.value.push(prefix+dynamicMainContent)
        } catch (error) {
            console.error(error)
        }
    })

    const styleEl = document.createElement('style')
    styleEl.innerHTML = styleText
    document.head.appendChild(styleEl)
})

</script>

<template>
    <!-- use for each -->
    <div v-for="item in mainContent">
        <div v-html="item"></div>
    </div>
</template>